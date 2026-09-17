import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, readCompletion } from '../lib/local-model/protocol';
import { loadModel, generateLocally, stopModel } from '../lib/local-model/client';

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

test('worker loading, inference, cancellation and reload lifecycle', async () => {
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
    stopModel();
  } finally {
    stopModel();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
