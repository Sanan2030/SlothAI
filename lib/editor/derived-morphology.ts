import type { GenerateFormsRequest, GrammaticalCase, MorphologicalAnalysis, MorphologicalFeatures, MorphologyEngine } from './contracts/morphology';
import { foldLetters } from './dictionary';

/** Runtime-only extension. Frozen neural feature extractors keep the original
 * engine, so adding a paradigm cannot silently change deployed model inputs. */
const reviewedAdjectives = new Set('ciddi rəqəmsal təşkilati strateji ümumi güclü vacib'.split(' '));
const reviewedNouns = 'təşkilat mövzu heyət rüb infrastruktur konfiqurasiya kommunikasiya motivasiya meyar komissiya platforma parametr dokumentasiya bölüşdürmə arxivləşdirmə səlahiyyət aidiyyət vəziyyət başlıq məmnuniyyət əməliyyat inteqrasiya paytaxt qiymət keyfiyyət abidə as bağlantı'.split(' ');
const lower = (word: string) => word.normalize('NFC').toLocaleLowerCase('az-AZ');
const vowel = (word: string) => word.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a';
const harmonyA = (word: string) => /[əeiöü]/u.test(vowel(word)) ? 'ə' : 'a';
const harmonyI = (word: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[vowel(word)]!;
const endsVowel = (word: string) => /[aəeıioöuü]$/u.test(word);
const cases: GrammaticalCase[] = ['nominative', 'genitive', 'dative', 'accusative', 'locative', 'ablative'];

export class DerivedMorphologyEngine implements MorphologyEngine {
  private readonly forms = new Map<string, MorphologicalAnalysis[]>();
  private readonly byLemma = new Map<string, Set<string>>();
  private readonly folded = new Map<string, Set<string>>();
  constructor(private readonly base: MorphologyEngine) {
    for (const lemma of reviewedNouns) {
      // Existing reviewed paradigms have precedence, including irregular stems.
      if (base.generateForms({ lemma, pos: 'noun', limit: 1 }).length) continue;
      for (const plural of [false, true]) for (const owner of [0, 1, 2, 3]) for (const ownersPlural of owner === 0 || owner === 3 ? [false] : [false, true]) {
        const stem = lemma + (plural ? 'l' + harmonyA(lemma) + 'r' : '');
        const possessive = owner === 0 ? '' : owner === 3 ? (endsVowel(stem) ? 's' : '') + harmonyI(stem)
          : (endsVowel(stem) ? '' : harmonyI(stem)) + (owner === 1 ? 'm' : 'n') + (ownersPlural ? harmonyI(stem) + 'z' : '');
        const softened = stem.endsWith('q') && /^[aəeıioöuü]/u.test(possessive) ? stem.slice(0, -1) + 'ğ' : stem;
        const possessed = softened + possessive;
        for (const grammaticalCase of cases) {
          const ending = grammaticalCase === 'nominative' ? ''
            : grammaticalCase === 'genitive' ? (endsVowel(possessed) ? 'n' : '') + harmonyI(possessed) + 'n'
              : grammaticalCase === 'dative' ? (owner === 3 ? 'n' : endsVowel(possessed) ? 'y' : '') + harmonyA(possessed)
                : grammaticalCase === 'accusative' ? (owner === 3 || endsVowel(possessed) ? 'n' : '') + harmonyI(possessed)
                  : (owner === 3 ? 'n' : '') + 'd' + harmonyA(possessed) + (grammaticalCase === 'ablative' ? 'n' : '');
          const beforeEnding = possessed.endsWith('q') && /^[aəeıioöuü]/u.test(ending) ? possessed.slice(0, -1) + 'ğ' : possessed;
          const surface = beforeEnding + ending;
          const row: MorphologicalAnalysis = { surface, lemma, pos: 'noun', source: 'rule', features: {
            number: plural ? 'plural' : 'singular', case: grammaticalCase,
            ...(owner ? { possessivePerson: owner as 1 | 2 | 3, possessiveNumber: ownersPlural ? 'plural' : 'singular' } : {}),
          } };
          const records = this.forms.get(surface) ?? []; records.push(row); this.forms.set(surface, records);
          const forms = this.byLemma.get(lemma) ?? new Set<string>(); forms.add(surface); this.byLemma.set(lemma, forms);
          const variants = this.folded.get(foldLetters(surface)) ?? new Set<string>(); variants.add(surface); this.folded.set(foldLetters(surface), variants);
        }
      }
    }
  }
  private derived(word: string): readonly MorphologicalAnalysis[] {
    // Reviewed nominal stems may form a location/assignment passive in -lAn.
    if (/(?:lanıb|lənib)$/u.test(word)) {
      const stem = word.slice(0, -5);
      const ending = 'l' + harmonyA(stem) + 'n' + harmonyI(stem) + 'b';
      if (word === stem + ending && stem === 'ünvan') return [{ surface: word, lemma: 'ünvanla', pos: 'verb', source: 'rule',
        features: { tense: 'evidential-past', person: 3, number: 'singular', polarity: 'positive', derivation: ['passive'] } }];
    }
    if (/(?:dakı|dəki)$/u.test(word)) {
      const base = word.slice(0, -2);
      return this.analyzeWord(base).filter(row => row.pos === 'noun' && row.features.case === 'locative')
        .map(row => ({ ...row, surface: word, pos: 'adjective', features: { ...row.features, derivation: [...(row.features.derivation ?? []), 'relative'] } }));
    }
    if (/(?:la|lə)$/u.test(word)) {
      const base = word.slice(0, -2);
      if (word.slice(-2) !== 'l' + harmonyA(base)) return [];
      return this.analyzeWord(base).filter(row => row.pos === 'noun' && row.features.case === 'nominative')
        .map(row => ({ ...row, surface: word, features: { ...row.features, derivation: [...(row.features.derivation ?? []), 'comitative'] } }));
    }
    return [];
  }
  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const surface = lower(word), original = this.base.analyzeWord(surface);
    if (original.some(row => row.source === 'rule')) return original;
    if (reviewedAdjectives.has(surface)) return [{ surface, lemma: surface, pos: 'adjective', features: {}, source: 'lexicon' }];
    const derived = this.derived(surface);
    return this.forms.get(surface) ?? (derived.length ? derived : original);
  }
  findByFoldedForm(word: string): string | undefined {
    const raw = lower(word), original = this.base.findByFoldedForm?.(raw);
    if (original) return original;
    const possible = new Set(this.folded.get(foldLetters(raw)) ?? []);
    if (/(?:lanib|lenib)$/u.test(foldLetters(raw))) {
      const stem = this.findByFoldedForm(raw.slice(0, -5));
      if (stem) { const candidate = stem + 'l' + harmonyA(stem) + 'n' + harmonyI(stem) + 'b'; if (this.derived(candidate).length) possible.add(candidate); }
    }
    for (const suffix of ['la', 'lə', 'kı', 'ki']) {
      if (!foldLetters(raw).endsWith(foldLetters(suffix))) continue;
      const stem = this.findByFoldedForm(raw.slice(0, -suffix.length));
      if (stem && this.derived(stem + suffix).length) possible.add(stem + suffix);
    }
    const compatible = [...possible].filter(value => [...raw].every((letter, at) => !/[əıçğöşü]/u.test(letter) || value[at] === letter));
    return compatible.length === 1 ? compatible[0] : undefined;
  }
  isValidWordForm(word: string): boolean {
    return this.base.isValidWordForm(word) || this.analyzeWord(word).some(row => row.source === 'rule');
  }
  correctMalformedForm(word: string): string | undefined { return this.base.correctMalformedForm?.(word); }
  generateForms(request: GenerateFormsRequest): readonly string[] {
    const limit = Math.max(0, Math.min(request.limit ?? 64, 256)), output = [...this.base.generateForms(request)];
    for (const surface of this.byLemma.get(lower(request.lemma)) ?? []) {
      const records = this.forms.get(surface)!;
      if (output.length >= limit) break;
      if (records.some(row => row.lemma === lower(request.lemma) && (!request.pos || row.pos === request.pos)
        && Object.entries(request.features ?? {}).every(([key, value]) => JSON.stringify(row.features[key as keyof MorphologicalFeatures]) === JSON.stringify(value)))) output.push(surface);
    }
    return output.slice(0, limit);
  }
  stripSuffixes(word: string) {
    return this.analyzeWord(word).filter(row => row.source === 'rule').map(row => ({ stem: row.lemma, removedSuffixes: [lower(word).slice(row.lemma.length)].filter(Boolean) }));
  }
}
