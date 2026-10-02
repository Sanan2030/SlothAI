import bundleJSON from './bounded-model.json';
import type { Token } from '../local-ai/core';
import type { PairedModel } from '../local-ai/paired';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { rankAttention, transpositionIndex, ATTENTION_VERSION, type AttentionArtifact } from './attention';
const artifact = bundleJSON.artifact as AttentionArtifact, lexicon = bundleJSON.lexicon as PairedModel;
if (artifact.featureVersion !== ATTENTION_VERSION || artifact.candidateMode !== 'bounded-edits'
  || artifact.network.ranker.inputs !== 71 || artifact.threshold < 0.9999) {
  throw new Error('Unsupported or insufficiently conservative bounded spelling artifact.');
}
const index = transpositionIndex(lexicon);
/** Sigmoid scores rank candidates; they are not calibrated correctness probabilities. */
export function boundedCorrection(raw: string, tokens: Token[], at: number): string | undefined {
  // Match training protection, including sentence-initial capitalized words.
  if (/\p{Lu}/u.test(raw) || canonicalProtectedTerm(raw) || isCanonicalEntity(raw)) return undefined;
  const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
  return decision?.accepted ? decision.candidate : undefined;
}
