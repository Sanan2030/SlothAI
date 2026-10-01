import type { Network } from './network';
import type { PairedModel } from '../local-ai/paired';
export interface NeuralArtifact {
  version: 1; featureVersion: number; corpusSha256: string; lexical: Network; agreement: Network;
  lexicon: PairedModel; lexicalThreshold: number; lexicalMargin: number; agreementThreshold: number;
}
