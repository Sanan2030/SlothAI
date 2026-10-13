import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorClient, MAX_QUEUED_EDITOR_TASKS, type EditorWorker } from '../lib/workers/editor-client';
import type { EditorWorkerRequest, EditorWorkerResponse } from '../lib/workers/editor-protocol';
import { chooseWorkerBudget } from '../lib/workers/worker-budget';
const result = { transformedText: 'Salam.', metadata: { correctionsMade: 1, detectedLanguage: 'az', executionTimeMs: 1, strategyUsed: 'text-corrector', engine: 'local-rules' as const } };
function fake() {
  let stopped = 0; const requests: EditorWorkerRequest[] = [];
  const worker: EditorWorker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: value => { requests.push(value); }, terminate: () => { stopped++; } };
  return { worker, requests, stopped: () => stopped, reply: (data: EditorWorkerResponse) => worker.onmessage?.({ data } as MessageEvent<EditorWorkerResponse>) };
}
test('one-worker devices queue independent work and ignore stale replies', async () => {
  const f = fake(), client = new EditorClient(() => f.worker);
  const pending = client.transform('text-corrector', { text: 'salam' });
  const next = client.transform('gmail-corrector', { text: 'ikinci' });
  assert.equal(f.requests.length, 1);
  f.reply({ id: 99, result }); f.reply({ id: 1, result });
  assert.deepEqual(await pending, result); assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].strategyId, 'gmail-corrector');
  f.reply({ id: 2, result }); assert.deepEqual(await next, result);
  client.dispose(); assert.equal(f.stopped(), 1);
});

test('two workers dispatch text/mail concurrently and route out-of-order results', async () => {
  const workers = [fake(), fake()]; let at = 0;
  const client = new EditorClient(() => workers[at++].worker, undefined, { editorWorkers: 2 });
  const text = client.transform('text-corrector', { text: 'mətn' });
  const mail = client.transform('gmail-corrector', { text: 'məktub' });
  const queuedRequest = { text: 'üçüncü', options: { preserveFormatting: true } };
  const queued = client.transform('text-corrector', queuedRequest);
  queuedRequest.text = 'changed'; queuedRequest.options.preserveFormatting = false;
  assert.deepEqual(workers.map(worker => worker.requests.length), [1, 1]);
  workers[1].reply({ id: 1, result }); // Another worker's response cannot finish this task.
  assert.equal(workers[1].requests.length, 1);
  workers[1].reply({ id: 2, result: { ...result, transformedText: 'Məktub.' } });
  assert.equal((await mail).transformedText, 'Məktub.');
  assert.equal(workers[1].requests[1].request.text, 'üçüncü');
  assert.equal(workers[1].requests[1].request.options?.preserveFormatting, true);
  workers[1].reply({ id: 3, result: { ...result, transformedText: 'Üçüncü.' } });
  workers[0].reply({ id: 1, result: { ...result, transformedText: 'Mətn.' } });
  assert.equal((await queued).transformedText, 'Üçüncü.');
  assert.equal((await text).transformedText, 'Mətn.');
  client.dispose();
});

test('a failed worker leaves independent work alive and dispatches queued work', async () => {
  const workers = [fake(), fake(), fake()]; let at = 0;
  const client = new EditorClient(() => workers[at++].worker, undefined, { editorWorkers: 2 });
  const failed = assert.rejects(client.transform('text-corrector', { text: 'bir' }), /açılmadı/u);
  const healthy = client.transform('gmail-corrector', { text: 'iki' });
  const queued = client.transform('text-corrector', { text: 'üç' });
  workers[0].worker.onerror?.({ type: 'error' } as ErrorEvent);
  await failed;
  assert.equal(workers[0].stopped(), 1); assert.equal(workers[1].stopped(), 0);
  assert.equal(workers[2].requests[0].id, 3);
  workers[0].reply({ id: 3, result }); // A terminated worker cannot settle its replacement's task.
  workers[0].worker.onerror?.({ type: 'error' } as ErrorEvent);
  assert.equal(workers[2].stopped(), 0);
  workers[1].reply({ id: 2, result }); workers[2].reply({ id: 3, result });
  await Promise.all([healthy, queued]); client.dispose();
});

test('queued tasks get their own deadline only after they are dispatched', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fake(), client = new EditorClient(() => f.worker, 20);
  const first = client.transform('text-corrector', { text: 'bir' });
  const next = client.transform('text-corrector', { text: 'iki' });
  const rejected = assert.rejects(next, /həddini keçdi/u);
  context.mock.timers.tick(19); f.reply({ id: 1, result }); await first;
  context.mock.timers.tick(19); assert.equal(f.stopped(), 0);
  context.mock.timers.tick(1); await rejected; assert.equal(f.stopped(), 1);
});

test('bounded queues and disposal settle every accepted task', async () => {
  const f = fake(), client = new EditorClient(() => f.worker);
  const tasks = Array.from({ length: MAX_QUEUED_EDITOR_TASKS + 1 }, () =>
    assert.rejects(client.transform('text-corrector', { text: 'bir' }), /dayandırıldı/u));
  await assert.rejects(client.transform('text-corrector', { text: 'daşma' }), /növbəsi doludur/u);
  client.dispose(); await Promise.all(tasks);
  assert.equal(f.stopped(), 1); assert.equal(f.requests.length, 1);
});

test('draft preparation warms editor workers without sending a transformation', async () => {
  const workers = [fake(), fake()]; let at = 0;
  const client = new EditorClient(() => workers[at++].worker, undefined, { editorWorkers: 2, speculate: false });
  client.prepare('mətn'); client.prepare('mətn');
  assert.equal(at, 2); assert.deepEqual(workers.map(worker => worker.requests.length), [0, 0]);
  const text = client.transform('text-corrector', { text: 'mətn' });
  const mail = client.transform('gmail-corrector', { text: 'məktub' });
  assert.equal(at, 2); workers[0].reply({ id: 1, result }); workers[1].reply({ id: 2, result });
  await Promise.all([text, mail]); client.dispose();
});

test('resource budgets bound workers on small, unknown-memory and data-saving devices', () => {
  const low = { editorWorkers: 1, speculate: false };
  assert.deepEqual(chooseWorkerBudget({ available: false, cores: 8, memoryGB: 8 }), low);
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 2, memoryGB: 8 }), low);
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 8, memoryGB: 2 }), low);
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 8, memoryGB: 8, saveData: true }), low);
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 4, memoryGB: 4 }), { editorWorkers: 1, speculate: true });
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 8 }), { editorWorkers: 1, speculate: true });
  assert.deepEqual(chooseWorkerBudget({ available: true, cores: 8, memoryGB: 8 }), { editorWorkers: 2, speculate: true });
});
test('deadline terminates inference and a retry gets a new worker', async () => {
  const workers = [fake(), fake()]; let at = 0;
  const client = new EditorClient(() => workers[at++].worker, 15);
  await assert.rejects(client.transform('text-corrector', { text: 'salam' }), /həddini keçdi/u);
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

test('default deadline allows work past ten seconds and stops it at ten minutes', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fake(), client = new EditorClient(() => f.worker);
  const pending = client.transform('text-corrector', { text: 'salam' });
  const rejected = assert.rejects(pending, /10 dəqiqə/u);
  context.mock.timers.tick(10_000);
  assert.equal(f.stopped(), 0);
  context.mock.timers.tick(589_999);
  assert.equal(f.stopped(), 0);
  context.mock.timers.tick(1);
  await rejected;
  assert.equal(f.stopped(), 1);
});
