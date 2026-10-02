import artifactJSON from './attention-model.json';
import baseJSON from './model.json';
import type { PairedModel } from '../local-ai/paired';
import type { Token } from '../local-ai/core';
import { attentionLexicon, transpositionIndex, rankAttention, ATTENTION_VERSION, type AttentionArtifact } from './attention';
const artifact = artifactJSON as AttentionArtifact;
if (artifact.featureVersion !== ATTENTION_VERSION) throw new Error('Attention feature version does not match the trained artifact.');
const lexicon = attentionLexicon(baseJSON.lexicon as PairedModel, artifact.vocabulary), index = transpositionIndex(lexicon);
export function attentionCorrection(raw: string, tokens: Token[], at: number): string | undefined {
  if (/(?:andan?|əndən?|arkən|ərkən|ınca|incə)$/iu.test(raw)) return undefined;
  const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
  return decision?.accepted ? decision.candidate : undefined;
}
