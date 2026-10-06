import { createInferenceRunner } from '../editor/inference-cache';
import { isEstablishedSurface } from '../editor/lexicon';
import { getStrategyRegistry } from '../strategies/bootstrap';
import type { EditorWorkerRequest, EditorWorkerResponse } from './editor-protocol';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<EditorWorkerRequest>) => void; postMessage: (response: EditorWorkerResponse) => void };
scope.onmessage = async ({ data }) => {
  try {
    if (!Number.isSafeInteger(data.id) || typeof data.strategyId !== 'string' || typeof data.request?.text !== 'string') throw new Error('Sorğu formatı uyğun deyil.');
    const prepared = data.prepared ? createInferenceRunner(data.prepared, data.request.text, isEstablishedSurface) : undefined;
    const result = await getStrategyRegistry().get(data.strategyId).transform(data.request, prepared ? { inference: prepared.run } : undefined);
    if (prepared) result.metadata.inference = prepared.stats;
    scope.postMessage({ id: data.id, result });
  } catch (cause) {
    scope.postMessage({ id: data.id, error: cause instanceof Error ? cause.message : 'Mətn emal edilə bilmədi.' });
  }
};
