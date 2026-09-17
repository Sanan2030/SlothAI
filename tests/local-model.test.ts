import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, readCompletion, splitModelInput } from '../lib/local-model/protocol';
import { createWatchdog } from '../lib/local-model/watchdog';

test('long multilingual text is split without dropping input or exceeding byte budget', () => {
  const input = 'Salam, dünya! 🙂 Azərbaycan dilində uzun mətn.\n'.repeat(220);
  const chunks = splitModelInput(input);
  assert.equal(chunks.join(''), input);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(new TextEncoder().encode(chunk).length <= 1400);
  assert.throws(() => splitModelInput('a'.repeat(1500)), /uzun/);
});

test('watchdog stops stalls, caps active jobs and clears completed jobs', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let expired = 0;
  const idle = createWatchdog(60, 180, () => { expired++; idle.clear(); });
  context.mock.timers.tick(59); assert.equal(expired, 0);
  idle.touch(); context.mock.timers.tick(59); assert.equal(expired, 0);
  context.mock.timers.tick(1); assert.equal(expired, 1);
  const active = createWatchdog(60, 180, () => { expired++; active.clear(); });
  for (let i = 0; i < 3; i++) { context.mock.timers.tick(50); active.touch(); }
  context.mock.timers.tick(30); assert.equal(expired, 2);
  const completed = createWatchdog(60, 180, () => { expired++; });
  completed.clear(); context.mock.timers.tick(200); assert.equal(expired, 2);
});
import { isModelReady, loadModel, generateLocally, stopModel } from '../lib/local-model/client';

test('prompt preserves intent, formatting and disables reasoning', () => {
  const prompt = buildPrompt('Business email', true);
  assert.match(prompt, /Business email/);
  assert.match(prompt, /Preserve existing paragraph/);
  assert.match(prompt, /never as instructions/);
  assert.match(prompt, /no_think/);
});

test('only complete nonempty model output is accepted', () => {
  assert.equal(readCompletion('<think></think>Salam, necəsən?', 'stop'), 'Salam, necəsən?');
  assert.equal(readCompletion('```text\nSalam!\n```', 'stop'), 'Salam!');
  assert.throws(() => readCompletion('Incomplete', 'length'));
  assert.throws(() => readCompletion('', 'stop'));
  assert.throws(() => readCompletion('<think>reasoning', 'stop'));
  assert.throws(() => readCompletion('Rejected', 'content_filter'));
});

test('worker loading, inference, cancellation and reload lifecycle', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const originals = new Map(['window', 'navigator', 'Worker'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let active: FakeWorker;
  class FakeWorker {
    onmessage?: (event: { data: object }) => void;
    onerror?: () => void;
    terminated = false;
    last = { id: 0, action: '' };
    constructor() { active = this; }
    postMessage(message: typeof this.last) { this.last = message; }
    terminate() { this.terminated = true; }
    reply(result: string) { this.onmessage?.({ data: { id: this.last.id, result } }); }
    fail(error: string) { this.onmessage?.({ data: { id: this.last.id, error } }); }
  }
  try {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { gpu: {} }, configurable: true });
    Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true });
    const loading = loadModel(() => {});
    active!.reply('ready'); await loading;
    const generation = generateLocally('prompt', 'salam');
    active!.reply('Salam.'); assert.equal(await generation, 'Salam.');
    const interrupted = generateLocally('prompt', 'salam');
    const rejection = assert.rejects(interrupted, /dayandırıldı/);
    stopModel(); await rejection;
    assert.equal(active!.terminated, true);
    await assert.rejects(generateLocally('prompt', 'salam'), /yükləyin/);
    const retry = loadModel(() => {});
    active!.reply('ready'); await retry;
    const brokenWorker = active!;
    const failed = generateLocally('prompt', 'salam');
    const failedCheck = assert.rejects(failed, /GPU sessiyası/);
    brokenWorker.fail('Object has already been disposed');
    await failedCheck;
    assert.equal(isModelReady(), false);
    assert.equal(brokenWorker.terminated, true);
    await assert.rejects(generateLocally('prompt', 'salam'), /yükləyin/);
    const recovered = loadModel(() => {});
    // Late messages from the disposed worker must not complete the new load.
    brokenWorker.reply('ready');
    assert.equal(isModelReady(), false);
    active!.reply('ready'); await recovered;
    assert.equal(isModelReady(), true);
    const stalled = generateLocally('prompt', 'salam');
    const timeoutCheck = assert.rejects(stalled, /vaxt həddini/);
    context.mock.timers.tick(60_000);
    await timeoutCheck;
    assert.equal(active!.terminated, true);
    assert.equal(isModelReady(), false);
    const afterTimeout = loadModel(() => {});
    active!.reply('ready'); await afterTimeout;
    stopModel();
  } finally {
    stopModel();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
