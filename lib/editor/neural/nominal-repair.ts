import { fold } from '../local-ai/core';
import type { PairedModel } from '../local-ai/paired';
import { productiveMorphology } from '../productive-morphology';
import { skeleton } from './features';

const MAX_ROOT_INSPECTIONS = 32;
const MAX_BUCKET_ROOTS = 8;
const MAX_ROOT_LENGTH = 16;
const vowels = /^[aeiou]$/u;

/** Transfer a supported root spelling repair across inflections. A candidate
 * must retain the original suffix, have a reviewed noun analysis and be the
 * only plausible root. This is a conservative morphology fallback, not a new
 * neural probability or an exact-sentence replay table. */
export function createNominalRepair(model: PairedModel): (raw: string) => string | undefined {
  const buckets = new Map<string, string[]>();
  const missingConsonantBuckets = new Map<string, string[]>();
  const roots = new Set<string>();
  for (const word of Object.keys(model.words)) for (const row of productiveMorphology.analyzeWord(word)) {
    if (row.pos === 'noun' && row.source === 'rule' && row.lemma.length >= 4 && row.lemma.length <= MAX_ROOT_LENGTH) roots.add(row.lemma);
  }
  for (const root of [...roots].sort()) {
    const key = skeleton(root), values = buckets.get(key) ?? [];
    if (values.length < MAX_BUCKET_ROOTS) values.push(root);
    buckets.set(key, values);
    const foldedRoot = fold(root);
    for (let at = 0; at < foldedRoot.length; at++) {
      const letter = foldedRoot[at];
      if (vowels.test(letter) || (model.channels[`insert:${letter}`] ?? 0) < 2) continue;
      const shortened = skeleton(foldedRoot.slice(0, at) + foldedRoot.slice(at + 1));
      const alternatives = missingConsonantBuckets.get(shortened) ?? [];
      if (!alternatives.includes(root) && alternatives.length < MAX_BUCKET_ROOTS) alternatives.push(root);
      missingConsonantBuckets.set(shortened, alternatives);
    }
  }

  function supportedRootRepair(raw: string, root: string): boolean {
    const input = fold(raw), target = fold(root);
    // A single accidentally doubled letter, including before a case ending.
    for (let at = 1; at < raw.length; at++) if (raw[at] === raw[at - 1]
      && fold(raw.slice(0, at) + raw.slice(at + 1)) === target) return true;
    // One dropped root letter, supported by the learned insertion channel.
    // Vowels need one observation plus a verified unchanged noun suffix;
    // consonants retain the stronger evidence threshold.
    // The suffix is checked separately and cannot be shortened or invented.
    if (target.length === input.length + 1) {
      for (let at = 0; at < target.length; at++) if ((model.channels[`insert:${target[at]}`] ?? 0) >= (vowels.test(target[at]) ? 1 : 2)
        && target.slice(0, at) + target.slice(at + 1) === input) return true;
      return false;
    }
    if (input.length !== target.length || skeleton(raw) !== skeleton(root)) return false;
    const changes = [...input].map((letter, at) => ({ letter, to: target[at] })).filter(row => row.letter !== row.to);
    // Require an error channel observed during training. Diacritics-only
    // ambiguities remain the responsibility of the existing context model.
    return changes.length === 1 && vowels.test(changes[0].letter) && vowels.test(changes[0].to)
      && (model.channels[`sub:${changes[0].letter}>${changes[0].to}`] ?? 0) >= 2;
  }

  function nominalSurface(root: string, suffix: string): string | undefined {
    const proposed = root + suffix;
    const hasNounAnalysis = (surface: string, grammaticalCase?: 'locative' | 'nominative') => productiveMorphology.analyzeWord(surface).some(row =>
      row.source === 'rule' && row.pos === 'noun' && row.lemma === root && (!grammaticalCase || row.features.case === grammaticalCase));
    if (hasNounAnalysis(proposed)) return proposed;
    const restored = productiveMorphology.findByFoldedForm(proposed);
    if (restored && hasNounAnalysis(restored)) return restored;
    // Comitative -lA also requires a verified nominal base and vowel harmony.
    if (/(?:la|le)$/u.test(fold(proposed))) {
      const base = productiveMorphology.findByFoldedForm(proposed.slice(0, -2));
      if (base && hasNounAnalysis(base, 'nominative')) {
        const lastVowel = base.match(/[aıoueəiöü]/gu)?.at(-1);
        const ending = lastVowel && /[əeiöü]/u.test(lastVowel) ? 'lə' : 'la';
        if (fold(proposed.slice(-2)) === fold(ending)) return base + ending;
      }
    }
    // The productive noun paradigm currently stops at the locative case.
    // Its relative -kI form is accepted only over a verified locative noun;
    // arbitrary word endings or other derivational suffixes are not guessed.
    if (!/(?:daki|deki)$/u.test(fold(proposed))) return undefined;
    const base = productiveMorphology.findByFoldedForm(proposed.slice(0, -2));
    if (!base || !hasNounAnalysis(base, 'locative')) return undefined;
    return base + (base.endsWith('da') ? 'kı' : 'ki');
  }

  return raw => {
    const lower = raw.normalize('NFC').toLocaleLowerCase('az-AZ');
    if (!/^[\p{L}]{5,24}$/u.test(lower)) return undefined;
    // A converb ending can also resemble a possessed noun case ending.
    // Do not insert a root consonant to turn a dependent verb into a noun.
    const dependentEnding = /(?:andan?|enden?|arken|erken|inca|ince)$/u.test(fold(lower));
    const candidates = new Set<string>();
    let inspected = 0;
    for (let at = 4; at <= Math.min(MAX_ROOT_LENGTH, lower.length); at++) {
      const prefix = lower.slice(0, at), keys = new Set([skeleton(prefix)]);
      for (let i = 1; i < prefix.length; i++) if (prefix[i] === prefix[i - 1]) keys.add(skeleton(prefix.slice(0, i) + prefix.slice(i + 1)));
      const possibleRoots = new Set([...keys].flatMap(key => [
        ...(buckets.get(key) ?? []), ...(dependentEnding ? [] : missingConsonantBuckets.get(key) ?? []),
      ]));
      for (const root of possibleRoots) {
        if (++inspected > MAX_ROOT_INSPECTIONS) return undefined;
        if (!supportedRootRepair(prefix, root)) continue;
        // Bare roots lack enough evidence for consonant insertion: preserve yadda.
        if (lower.length - at < 2 && ![...prefix].some((letter, i) => i > 0 && letter === prefix[i - 1]
          && fold(prefix.slice(0, i) + prefix.slice(i + 1)) === fold(root))) continue;
        const surface = nominalSurface(root, lower.slice(at));
        if (surface && surface !== lower) candidates.add(surface);
        if (candidates.size > 1) return undefined; // Context cannot justify choosing between two meanings here.
      }
    }
    return candidates.size === 1 ? [...candidates][0] : undefined;
  };
}
