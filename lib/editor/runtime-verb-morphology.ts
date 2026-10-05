import type { MorphologyEngine, MorphologicalAnalysis, GenerateFormsRequest } from './contracts/morphology';
import { foldLetters } from './dictionary';

const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('az-AZ');
const lastVowel = (s: string) => s.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a';
const low = (s: string) => /[əeiöü]/u.test(lastVowel(s)) ? 'ə' : 'a';
const high = (s: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[lastVowel(s)]!;
const endsVowel = (s: string) => /[aəeıioöuü]$/u.test(s);
const voiced = (s: string) => /^(?:et|get|eşit|düzəlt|yarat|qayıt)$/u.test(s) ? s.slice(0, -1) + 'd' : s;

/** Runtime extension only: original classifier feature vocabularies stay frozen.
 * Bounded attested stems, genuine lemma/features, no arbitrary dictionary-stem
 * inflection. Synthetic paradigms are engineering rules, not reviewed training. */
export class RuntimeVerbMorphology implements MorphologyEngine {
  private readonly records = new Map<string, MorphologicalAnalysis[]>();
  private readonly byLemma = new Map<string, Set<string>>();
  private readonly folded = new Map<string, Set<string>>();
  constructor(private readonly base: MorphologyEngine) {
    const roots = 'çıx gəl get ol et hazırla yoxla yaz oxu işlə düşün danış çalış göndər düzəlt aç bağla yarat qur seç qoru saxla tap anla paylaş öyrən göstər dinlə izlə dəyiş ölç tamamla bildir qayıt yenilə al çat düş bit sür qal gəz'.split(' ');
    const stems = roots.map(stem => ({ stem, lemma: stem, derivation: [] as string[] }));
    // Only attested reflexive derivations; do not add -ş to every verb.
    stems.push({ stem: 'hazırlaş', lemma: 'hazırla', derivation: ['reflexive'] });
    for (const { stem, lemma, derivation } of stems) {
      const add = (surface: string, features: MorphologicalAnalysis['features']) => {
        const row: MorphologicalAnalysis = { surface, lemma, pos: 'verb', source: 'rule', features: {
          polarity: 'positive', ...(derivation.length ? { derivation } : {}), ...features } };
        const rows = this.records.get(surface) ?? []; rows.push(row); this.records.set(surface, rows);
        const forms = this.byLemma.get(lemma) ?? new Set<string>(); forms.add(surface); this.byLemma.set(lemma, forms);
        const bucket = this.folded.get(foldLetters(surface)) ?? new Set<string>(); bucket.add(surface); this.folded.set(foldLetters(surface), bucket);
      };
      const a = low(stem), i = high(stem);
      const infinitive = stem + 'm' + a + (a === 'ə' ? 'k' : 'q');
      add(infinitive, { mood: 'infinitive' });
      const softenedInfinitive = infinitive.slice(0, -1) + (a === 'ə' ? 'y' : 'ğ');
      for (const [grammaticalCase, ending] of [['dative', a], ['accusative', high(infinitive)], ['genitive', high(infinitive) + 'n'],
        ['locative', 'd' + a], ['ablative', 'd' + a + 'n']] as const)
        add((/^[aəeıioöuü]/u.test(ending) ? softenedInfinitive : infinitive) + ending, { mood: 'infinitive', case: grammaticalCase });
      const necessityI = a === 'ə' ? 'i' : 'ı';
      const necessity = stem + 'm' + a + 'l' + necessityI;
      add(necessity, { mood: 'necessity' });
      for (const [person, number, ending] of [
        [1, 'singular', a === 'ə' ? 'yəm' : 'yam'], [2, 'singular', a === 'ə' ? 'sən' : 'san'],
        [3, 'singular', 'd' + necessityI + 'r'], [1, 'plural', 'y' + necessityI + (a === 'ə' ? 'k' : 'q')],
        [2, 'plural', 's' + necessityI + 'n' + necessityI + 'z'], [3, 'plural', 'd' + necessityI + 'rl' + a + 'r'],
      ] as const) add(necessity + ending, { mood: 'necessity', tense: 'present', person, number });
      add(voiced(stem) + (endsVowel(stem) ? 'y' : '') + a + (a === 'ə' ? 'k' : 'q'), {
        mood: 'optative', person: 1, number: 'plural' });
      if (stem === 'sür' || stem === 'qal') {
        add(stem, { mood: 'imperative', person: 2, number: 'singular' });
        add(stem + 'm' + a + (a === 'ə' ? 'k' : 'q'), { mood: 'infinitive' });
        const root = stem + 'd' + i;
        for (const [person, number, suffix] of [[1, 'singular', 'm'], [2, 'singular', 'n'], [3, 'singular', ''],
          [1, 'plural', a === 'ə' ? 'k' : 'q'], [2, 'plural', 'n' + i + 'z'], [3, 'plural', 'l' + a + 'r']] as const)
          add(root + suffix, { tense: 'past', person, number });
        add(stem + i + 'b', { tense: 'evidential-past', person: 3, number: 'singular' });
      }
    }
  }
  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const raw = lower(word), output = [...this.base.analyzeWord(raw), ...(this.records.get(raw) ?? [])];
    // Synthetic past copula on an attested future: ol-acaq-dı, gəl-əcək-di.
    // A suffix must agree with the immediately preceding vowel, not ASCII input.
    if (/d[ıiuü]$/u.test(raw)) {
      const stem = raw.slice(0, -2);
      if (raw === stem + 'd' + high(stem)) for (const row of this.base.analyzeWord(stem))
        if (row.pos === 'verb' && row.features.tense === 'future' && row.features.person === 3)
          output.push({ ...row, surface: raw, features: { ...row.features, tense: 'future-in-past' } });
    }
    return output;
  }
  findByFoldedForm(word: string): string | undefined {
    const raw = lower(word), existing = this.base.findByFoldedForm?.(raw);
    if (existing) return existing;
    const candidates = [...(this.folded.get(foldLetters(raw)) ?? [])].filter(surface => [...raw].every((letter, at) =>
      !/[əıçğöşü]/u.test(letter) || surface[at] === letter));
    if (/d[ıiuü]$/u.test(foldLetters(raw))) {
      const stem = this.base.findByFoldedForm?.(raw.slice(0, -2));
      if (stem) { const surface = stem + 'd' + high(stem); if (this.analyzeWord(surface).some(row => row.features.tense === 'future-in-past')) candidates.push(surface); }
    }
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  isValidWordForm(word: string): boolean { return this.records.has(lower(word)) || this.base.isValidWordForm(word)
    || this.analyzeWord(word).some(row => row.features.tense === 'future-in-past'); }
  correctMalformedForm(word: string): string | undefined { return this.base.correctMalformedForm?.(word); }
  generateForms(request: GenerateFormsRequest): readonly string[] {
    const output = new Set(this.base.generateForms(request)), limit = Math.max(0, Math.min(request.limit ?? 64, 256));
    for (const surface of this.byLemma.get(lower(request.lemma)) ?? []) {
      const rows = this.records.get(surface)!;
      if (rows.some(row => row.lemma === lower(request.lemma) && (!request.pos || request.pos === row.pos)
        && Object.entries(request.features ?? {}).every(([key, value]) => JSON.stringify(row.features[key as keyof typeof row.features]) === JSON.stringify(value)))) output.add(surface);
    }
    return [...output].slice(0, limit);
  }
  stripSuffixes(word: string) {
    const rows = this.records.get(lower(word));
    return rows ? rows.map(row => ({ stem: row.lemma, removedSuffixes: [lower(word).slice(row.lemma.length)].filter(Boolean) })) : this.base.stripSuffixes(word);
  }
}
