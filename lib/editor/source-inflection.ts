/** Bounded on-demand paradigms over the pinned Hunspell source's lemma classes.
 * No model feature extractor is changed; source classes are lexical evidence,
 * not a claim of contextual POS tagging or general semantic understanding. */
import classes from './generated/az-stem-classes.json';
import { foldLetters } from './dictionary';
import type { MorphologicalAnalysis, MorphologicalFeatures } from './contracts/morphology';

type Stem = { lemma: string; pos: 'noun' | 'verb' | 'adjective' };
const index = new Map<string, Stem[]>();
for (const pos of ['noun', 'verb', 'adjective'] as const) for (const lemma of classes[pos].split(' ')) {
  const key = foldLetters(lemma), bucket = index.get(key) ?? [];
  bucket.push({ lemma, pos }); index.set(key, bucket);
}
const lower = (word: string) => word.toLocaleLowerCase('az-AZ');
const normalize = (word: string) => lower(word).replace(/sh/gu, 'ş').replace(/ch/gu, 'ç').replace(/gh/gu, 'ğ');
const last = (stem: string) => stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a';
const low = (stem: string) => /[əeiöü]/u.test(last(stem)) ? 'ə' : 'a';
const high = (stem: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[last(stem)]!;
const vowelEnd = (stem: string) => /[aəeıioöuü]$/u.test(stem);
// Lexical inflection class: su uses a y buffer in the singular possessive
// paradigm and genitive/accusative cases (suyum, suyun, suyu), not *sum/susu.
// Classify the lemma, rather than listing individual input/output spellings.
const yBufferNouns = new Set(['su']);
export const usesLexicalYBuffer = (lemma: string): boolean => yBufferNouns.has(lemma);
const soften = (stem: string, suffix: string) => /^[aəeıioöuü]/u.test(suffix) && (stem.match(/[aəeıioöuü]/gu)?.length ?? 0) >= 2
  ? stem.replace(/k$/u, 'y').replace(/q$/u, 'ğ') : stem;
const compatible = (raw: string, target: string) => [...raw].every((letter, at) => !/[əçğıöşü]/u.test(letter) || target[at] === letter);

export class SourceInflectionEngine {
  private readonly analyses = new Map<string, readonly MorphologicalAnalysis[]>();
  private readonly paradigms = new Map<string, ReadonlyMap<string, MorphologicalAnalysis[]>>();
  constructor(private readonly attested: (surface: string) => boolean) {}
  private paradigm(stem: Stem): ReadonlyMap<string, MorphologicalAnalysis[]> {
    const key = stem.pos + ':' + stem.lemma, cached = this.paradigms.get(key);
    if (cached) return cached;
    const result = new Map<string, MorphologicalAnalysis[]>();
    const add = (surface: string, features: MorphologicalFeatures) => {
      const folded = foldLetters(surface), rows = result.get(folded) ?? [];
      rows.push({ surface, lemma: stem.lemma, pos: stem.pos, features, source: 'rule' }); result.set(folded, rows);
    };
    const lemma = stem.lemma;
    add(lemma, {});
    if (stem.pos === 'noun') for (const plural of [false, true]) {
      const base = lemma + (plural ? 'l' + low(lemma) + 'r' : '');
      const yBuffer = !plural && yBufferNouns.has(lemma);
      for (const owner of [0, 1, 2, 3] as const) {
        const possession = owner === 0 ? '' : yBuffer ? 'y' + high(base) + (owner === 3 ? '' : owner === 1 ? 'm' : 'n')
          : owner === 3 ? (vowelEnd(base) ? 's' : '') + high(base)
          : (vowelEnd(base) ? '' : high(base)) + (owner === 1 ? 'm' : 'n');
        const owned = soften(base, possession) + possession;
        const alternatives = [owned];
        // Borrowed vowel-final nouns have an attested y-buffer subclass. Never
        // invent that subclass from the suffix alone (şöbə -> şöbəsi remains).
        if (owner === 3 && !plural && vowelEnd(base) && this.attested(base + 'y' + high(base))) alternatives.push(base + 'y' + high(base));
        for (const possessed of alternatives) {
          const endings = { nominative: '', genitive: (yBuffer && !owner ? 'y' : vowelEnd(possessed) ? 'n' : '') + high(possessed) + 'n',
            dative: (owner === 3 ? 'n' : vowelEnd(possessed) ? 'y' : '') + low(possessed),
            accusative: (yBuffer && !owner ? 'y' : owner === 3 || vowelEnd(possessed) ? 'n' : '') + high(possessed),
            locative: (owner === 3 ? 'n' : '') + 'd' + low(possessed),
            ablative: (owner === 3 ? 'n' : '') + 'd' + low(possessed) + 'n' } as const;
          for (const [grammaticalCase, ending] of Object.entries(endings)) add(soften(possessed, ending) + ending, {
            number: plural ? 'plural' : 'singular', case: grammaticalCase as keyof typeof endings,
            ...(owner ? { possessivePerson: owner, possessiveNumber: 'singular' } : {}) });
          if (!owner) add(base + 'l' + low(base), { number: plural ? 'plural' : 'singular', case: 'nominative', derivation: ['comitative'] });
        }
      }
      // Productive agent/person -lI derivation with plural and dative endings.
      const agent = lemma + 'l' + high(lemma);
      add(agent, { case: 'nominative', number: 'singular', derivation: ['adjectival'] });
      add(agent + 'l' + low(agent) + 'r' + low(agent), { case: 'dative', number: 'plural', derivation: ['agent'] });
    }
    if (stem.pos === 'verb') {
      for (const [person, number, ending] of [[1, 'singular', 'm'], [2, 'singular', 'n'], [3, 'singular', ''],
        [1, 'plural', low(lemma) === 'ə' ? 'k' : 'q'], [2, 'plural', 'n' + high(lemma) + 'z'], [3, 'plural', 'l' + low(lemma) + 'r']] as const) {
        add(lemma + 'd' + high(lemma) + ending, { tense: 'past', person, number });
        add(lemma + 'm' + high(lemma) + 'şd' + high(lemma) + ending, { tense: 'pluperfect', person, number });
      }
      const participle = lemma + 'd' + high(lemma) + (low(lemma) === 'ə' ? 'y' : 'ğ') + high(lemma);
      add(participle + 'n' + high(lemma), { tense: 'past', case: 'accusative', possessivePerson: 3, derivation: ['participle'] });
      add(participle + 'n' + high(lemma) + 'n', { tense: 'past', case: 'genitive', possessivePerson: 3, derivation: ['participle'] });
    }
    if (this.paradigms.size >= 512) this.paradigms.delete(this.paradigms.keys().next().value!);
    this.paradigms.set(key, result); return result;
  }
  candidates(raw: string): readonly MorphologicalAnalysis[] {
    const normalized = normalize(raw);
    if (!/^[a-zəçğıöşü]{2,40}$/u.test(normalized)) return [];
    const cached = this.analyses.get(normalized); if (cached) return cached;
    const query = foldLetters(normalized), rows: MorphologicalAnalysis[] = [];
    for (let cut = 2; cut <= query.length; cut++) {
      const prefix = query.slice(0, cut);
      const stemKeys = new Set([prefix]);
      if (/[yg]$/u.test(prefix)) stemKeys.add(prefix.slice(0, -1) + (prefix.endsWith('y') ? 'k' : 'q'));
      for (const stemKey of stemKeys) for (const stem of index.get(stemKey) ?? []) {
        rows.push(...(this.paradigm(stem).get(query) ?? []).filter(row => compatible(normalized, row.surface)));
        // Denominative -lAn-dIr is productive, but only a classified noun can
        // license it. Existing observed causative stems retain their own lemma.
        if (stem.pos === 'noun') {
          const derived = stem.lemma + 'l' + low(stem.lemma) + 'nd' + high(stem.lemma) + 'r';
          for (const row of this.paradigm({ lemma: derived, pos: 'verb' }).get(query) ?? []) if (compatible(normalized, row.surface)) {
            rows.push({ ...row, lemma: derived, features: { ...row.features, derivation: ['denominative:' + stem.lemma, 'causative'] } });
          }
        }
      }
    }
    const unique = [...new Map(rows.map(row => [row.surface + ':' + row.lemma + ':' + row.pos + ':' + JSON.stringify(row.features), row])).values()];
    if (this.analyses.size >= 4096) this.analyses.clear(); this.analyses.set(normalized, unique); return unique;
  }
  analyze(word: string): readonly MorphologicalAnalysis[] { return this.candidates(word).filter(row => row.surface === lower(word)); }
  restore(word: string): string | undefined {
    const candidates = new Set(this.candidates(word).map(row => row.surface));
    return candidates.size === 1 ? [...candidates][0] : undefined;
  }
  /** A single a/e vowel confusion is tried only after all unchanged-skeleton
   * analyses abstain, and only one verified inflection may survive. */
  restoreVowelConfusion(word: string): string | undefined {
    const raw = normalize(word);
    if (raw.length < 5 || this.candidates(raw).length) return undefined;
    const values = new Set<string>();
    for (let at = 0; at < raw.length - 1; at++) {
      if (raw[at] !== 'a' && raw[at] !== 'e') continue;
      const variant = raw.slice(0, at) + (raw[at] === 'a' ? 'e' : 'a') + raw.slice(at + 1);
      for (const row of this.candidates(variant)) if (compatible(raw, row.surface) && row.surface !== row.lemma) values.add(row.surface);
    }
    return values.size === 1 ? [...values][0] : undefined;
  }
}
