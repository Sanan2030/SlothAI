import artifactJSON from './attention-model.json';
import baseJSON from './model.json';
import type { PairedModel } from '../local-ai/paired';
import { fold, type Token } from '../local-ai/core';
import { attentionLexicon, transpositionIndex, transpositionCandidates, rankAttention, ATTENTION_VERSION, type AttentionArtifact } from './attention';
const artifact = artifactJSON as AttentionArtifact;
if (artifact.featureVersion !== ATTENTION_VERSION) throw new Error('Attention feature version does not match the trained artifact.');
const lexicon = attentionLexicon(baseJSON.lexicon as PairedModel, artifact.vocabulary), index = transpositionIndex(lexicon);
export function attentionCorrection(raw: string, tokens: Token[], at: number): string | undefined {
  if (/(?:andan?|əndən?|arkən|ərkən|ınca|incə)$/iu.test(raw)) return undefined;
  const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
  return decision?.accepted ? decision.candidate : undefined;
}

/** Freeze ambiguous unknown surfaces when attention abstains, so a later
 * dictionary guess cannot silently turn that abstention into a wrong edit. */
export function unresolvedAttentionAmbiguity(raw: string, tokens: Token[], at: number): boolean {
  const candidates = transpositionCandidates(index, raw);
  const counts = new Map<string, number>();
  for (const candidate of candidates) { const key = fold(candidate); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts.values()].some(count => count > 1) && !rankAttention(artifact, lexicon, index, raw, tokens, at)?.accepted;
}

/** Cheap vocabulary lookup; candidate presence keeps context inference eligible. */
export function hasAttentionCandidate(raw: string): boolean { return transpositionCandidates(index, raw).length > 0; }
