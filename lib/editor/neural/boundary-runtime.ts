import artifactJSON from './sentence-boundary-model.json';
import { prepareBoundaryContext, eligibleBoundary, boundaryFeatures, BOUNDARY_INPUTS,
  BOUNDARY_FEATURE_VERSION, type NeuralBoundaryArtifact } from './boundary-features';
import { predictNetwork } from './network';
import { detectQuestion } from '../punctuation';

const bundled = artifactJSON as NeuralBoundaryArtifact;
const verified = new WeakSet<NeuralBoundaryArtifact>();
export function verifyBoundaryArtifact(artifact: NeuralBoundaryArtifact): void {
  if (verified.has(artifact)) return;
  const { network } = artifact;
  if (artifact.version !== 1 || artifact.featureVersion !== BOUNDARY_FEATURE_VERSION
    || network.inputs !== BOUNDARY_INPUTS || network.hidden !== 12
    || network.w1.length !== network.inputs * network.hidden || network.b1.length !== network.hidden
    || network.w2.length !== network.hidden || !Number.isFinite(artifact.threshold)
    || artifact.threshold < 0.97 || artifact.threshold > 1
    || ![...network.w1, ...network.b1, ...network.w2, network.b2].every(Number.isFinite)) {
    throw new Error('Unsupported sentence-boundary neural artifact.');
  }
  verified.add(artifact);
}

/** Insert gaps only; user punctuation, word spelling and original spans survive. */
export function insertNeuralBoundaries(text: string, artifact = bundled): string {
  verifyBoundaryArtifact(artifact);
  if (artifact.threshold === 1) return text;
  const context = prepareBoundaryContext(text);
  let output = '', cursor = 0, clauseStart = 0;
  for (let at = 0; at < context.tokens.length - 1; at++) {
    if (at && context.tokens[at].sentence !== context.tokens[at - 1].sentence) clauseStart = context.tokens[at].start;
    if (!eligibleBoundary(context, at)
      || predictNetwork(artifact.network, boundaryFeatures(context, at)) < artifact.threshold) continue;
    const end = context.tokens[at].end;
    output += text.slice(cursor, end) + (detectQuestion(text.slice(clauseStart, end)) ? '?' : '.');
    cursor = end; clauseStart = end;
  }
  return output + text.slice(cursor);
}
