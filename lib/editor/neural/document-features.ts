import type { PairedModel } from '../local-ai/paired';
import { normalizeDigraphs } from '../local-ai/paired';
import { fold, type Token } from '../local-ai/core';
import { lexicalFeatures } from './features';
import type { Network } from './network';

export interface DocumentSpellingModel {
  version: 1;
  featureVersion: 1;
  corpusSHA256: string;
  lexicon: PairedModel;
  network: Network;
  threshold: number;
  margin: number;
  minimumContext: number;
}

export function documentContext(model: PairedModel, candidate: string, tokens: readonly Token[], at: number): number {
  const observed = model.words[candidate]?.context ?? {};
  const nearby = new Set(tokens.slice(Math.max(0, at - 5), at + 6)
    .filter((token, offset) => offset + Math.max(0, at - 5) !== at && token.sentence === tokens[at].sentence)
    .map(token => fold(normalizeDigraphs(token.word.toLocaleLowerCase('az-AZ')))));
  return [...nearby].filter(word => (observed[word] ?? 0) > 0).length;
}

export function documentFeatures(model: PairedModel, raw: string, candidate: string, tokens: readonly Token[], at: number): number[] {
  return [...lexicalFeatures(model, raw, candidate, tokens, at),
    Math.min(4, documentContext(model, candidate, tokens, at)) / 4];
}
