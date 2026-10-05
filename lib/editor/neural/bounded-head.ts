import { productiveMorphology } from '../productive-morphology';
import { fold, type Token } from '../local-ai/core';
import type { PairedModel } from '../local-ai/paired';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { preservesDiacritics } from './diacritics';
import { rankAttention, transpositionIndex, ATTENTION_VERSION, type AttentionArtifact } from './attention';
export interface BoundedBundle { artifact: AttentionArtifact; lexicon: PairedModel }
export type BoundedHead = (raw: string, tokens: Token[], at: number) => string | undefined;
/** Shared by offline release evaluation and production; scores are not probabilities. */
export function createBoundedHead({ artifact, lexicon }: BoundedBundle, terms: readonly string[] = [], minimumThreshold = 0.9999): BoundedHead {
  if (artifact.version !== 1 || artifact.featureVersion !== ATTENTION_VERSION || artifact.candidateMode !== 'bounded-edits'
    || artifact.network.ranker.inputs !== 71 || !Number.isFinite(artifact.threshold) || artifact.threshold < minimumThreshold) {
    throw new Error('Unsupported or insufficiently conservative bounded spelling artifact.');
  }
  const index = transpositionIndex(lexicon);
  const protectedTerms = new Set(terms.map(term => term.toLocaleLowerCase('az-AZ')));
  return (raw, tokens, at) => {
    if (/\p{Lu}/u.test(raw) || canonicalProtectedTerm(raw) || isCanonicalEntity(raw) || protectedTerms.has(raw.toLocaleLowerCase('az-AZ'))) return undefined;
    const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
    return decision?.accepted && preservesDiacritics(raw, decision.candidate) ? decision.candidate : undefined;
  };
}
/** The established model has precedence; domain knowledge only fills abstentions. */
export function composeBoundedHeads(primary: BoundedHead, domain: BoundedHead): BoundedHead {
  return (raw, tokens, at) => primary(raw, tokens, at) ?? domain(raw, tokens, at);
}

/** Domain adaptation repairs interior typos only. Keeping both word edges avoids
 * turning a damaged inflection into a confident but wrong bare stem, or treating
 * an accidentally separated suffix as an unrelated word. The primary head is
 * unchanged and may handle other error categories at its own strict threshold. */
export function createDomainHead(bundle: BoundedBundle, terms: readonly string[] = []): BoundedHead {
  const predict = createBoundedHead(bundle, terms, 0.7);
  return (raw, tokens, at) => {
    const candidate = predict(raw, tokens, at);
    return candidate && preservesWordEdges(raw, candidate) && (isSingleMissingVowel(raw, candidate) || isMissingRepeatedConsonant(raw, candidate)) ? candidate : undefined;
  };
}
export function preservesWordEdges(raw: string, candidate: string): boolean {
  const input = fold(raw), output = fold(candidate);
  return input.length >= 4 && output.length >= 4 && input[0] === output[0] && input.at(-1) === output.at(-1);
}

/** Interior vowel insertion category. The separate repeated-consonant
 * category retains its noun validation; arbitrary suffix/voice edits abstain. */
export function isSingleMissingVowel(raw: string, candidate: string): boolean {
  const input = fold(raw), output = fold(candidate);
  if (output.length !== input.length + 1) return false;
  for (let at = 1; at < output.length - 1; at++) {
    if (/[aeiou]/u.test(output[at]) && output.slice(0, at) + output.slice(at + 1) === input) return true;
  }
  return false;
}

/** A lost doubled root consonant may be restored in a verified noun; an
 * arbitrary n/l insertion could change voice and remains prohibited. */
export function isMissingRepeatedConsonant(raw: string, candidate: string): boolean {
  const input = fold(raw), output = fold(candidate);
  if (output.length !== input.length + 1 || !productiveMorphology.analyzeWord(candidate).some(row => row.pos === 'noun' && row.source === 'rule')) return false;
  for (let at = 1; at < output.length - 1; at++) {
    if (!/[aeiou]/u.test(output[at]) && output[at] === output[at - 1] && output.slice(0, at) + output.slice(at + 1) === input) return true;
  }
  return false;
}
