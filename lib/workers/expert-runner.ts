import { proposeEdits, type ModelProposal } from '../editor/inference-cache';
import type { ExpertRequest } from './expert-protocol';

/** Each worker imports only its head; no LLM, network request, or training. */
export async function runExpert(request: ExpertRequest): Promise<ModelProposal[]> {
  if (!Number.isSafeInteger(request.revision) || request.revision < 1 || typeof request.text !== 'string' || request.text.length > 10_000) throw new Error('Ekspert sorğusu uyğun deyil.');
  const model = request.stage === 'log-spelling' ? (await import('../editor/neural/log-runtime')).logSpelling
    : request.stage === 'sentence-boundary' ? (await import('../editor/neural/boundary-runtime')).insertNeuralBoundaries : undefined;
  if (!model) throw new Error('Naməlum ekspert.');
  // Structured documents use the existing lossless scanners in the final pass.
  // Guessing fragment offsets here would risk modifying markup or fenced code.
  if (/[`<>]|https?:\/\/|\S+@\S+|(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\||\d+[.)]\s)/u.test(request.text)) return [];
  const inputs = request.stage === 'log-spelling' ? [request.text] : [...new Set(request.text.split(/\r?\n/u).filter(line => line.trim()))].slice(0, 255);
  return inputs.flatMap(input => {
    const output = model(input), edits = proposeEdits(input, output, request.stage);
    return edits ? [{ revision: request.revision, stage: request.stage, input, output, edits }] : [];
  });
}
