import { getStrategyRegistry } from '../strategies/bootstrap';
import type { EditorWorkerRequest, EditorWorkerResponse } from './editor-protocol';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<EditorWorkerRequest>) => void; postMessage: (response: EditorWorkerResponse) => void };
scope.onmessage = async ({ data }) => {
  try {
    if (!Number.isSafeInteger(data.id) || typeof data.strategyId !== 'string' || typeof data.request?.text !== 'string') throw new Error('Sorğu formatı uyğun deyil.');
    const result = await getStrategyRegistry().get(data.strategyId).transform(data.request);
    scope.postMessage({ id: data.id, result });
  } catch (cause) {
    scope.postMessage({ id: data.id, error: cause instanceof Error ? cause.message : 'Mətn emal edilə bilmədi.' });
  }
};
