import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorClient, type EditorWorker } from '../lib/workers/editor-client';
import type { EditorWorkerResponse } from '../lib/workers/editor-protocol';
const result = { transformedText: 'Salam.', metadata: { correctionsMade: 1, detectedLanguage: 'az', executionTimeMs: 1, strategyUsed: 'text-corrector', engine: 'local-rules' as const } };
function fake() {
  let stopped = 0; const requests: unknown[] = [];
  const worker: EditorWorker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: value => { requests.push(value); }, terminate: () => { stopped++; } };
  return { worker, requests, stopped: () => stopped, reply: (data: EditorWorkerResponse) => worker.onmessage?.({ data } as MessageEvent<EditorWorkerResponse>) };
}
test('worker sends requests, ignores stale replies and rejects overlapping work', async () => {
  const f = fake(), client = new EditorClient(() => f.worker);
  const pending = client.transform('text-corrector', { text: 'salam' });
  await assert.rejects(client.transform('text-corrector', { text: 'ikinci' }), /davam/u);
  f.reply({ id: 99, result }); f.reply({ id: 1, result });
  assert.deepEqual(await pending, result); assert.equal(f.requests.length, 1); client.dispose(); assert.equal(f.stopped(), 1);
});
test('deadline terminates inference and a retry gets a new worker', async () => {
  const workers = [fake(), fake()]; let at = 0;
  const client = new EditorClient(() => workers[at++].worker, 15);
  await assert.rejects(client.transform('text-corrector', { text: 'salam' }), /10 saniyə/u);
  assert.equal(workers[0].stopped(), 1);
  const retry = client.transform('text-corrector', { text: 'salam' }); workers[1].reply({ id: 2, result });
  assert.deepEqual(await retry, result); client.dispose();
});
test('worker errors and component disposal settle pending promises', async () => {
  const f = fake(), client = new EditorClient(() => f.worker);
  const pending = client.transform('text-corrector', { text: 'salam' }); f.worker.onerror?.({ type: 'error' } as ErrorEvent);
  await assert.rejects(pending, /açılmadı/u); assert.equal(f.stopped(), 1);
  const g = fake(), c = new EditorClient(() => g.worker), next = c.transform('text-corrector', { text: 'salam' }); c.dispose();
  await assert.rejects(next, /dayandırıldı/u);
});
