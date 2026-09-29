import assert from 'node:assert/strict';
import test from 'node:test';
import { appendTransformLog, exportTransformLog, readTransformLog, TRANSFORM_LOG_KEY,
  type TransformLogEntry } from '../lib/editor/transform-log';

test('the browser journal keeps the newest 50 pairs and exports valid JSON', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
  const entry: TransformLogEntry = { id: '0', at: new Date().toISOString(), module: 'text',
    input: 'salam', output: 'Salam.', source: 'transformed' };
  for (let i = 0; i < 55; i++) appendTransformLog(storage, { ...entry, id: String(i) });
  assert.equal(readTransformLog(storage).length, 50);
  assert.equal(readTransformLog(storage)[0].id, '5');
  const exported = JSON.parse(exportTransformLog(storage)) as { schemaVersion: number; entries: TransformLogEntry[] };
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.entries[49].id, '54');
  appendTransformLog(storage, { ...entry, id: 'mail', module: 'mail', greeting: 'Salam,', output: 'Salam,\n\nSalam.' });
  assert.equal(readTransformLog(storage).length, 50);
  assert.equal(readTransformLog(storage).at(-1)?.module, 'mail');
  assert.equal(readTransformLog(storage).at(-2)?.module, 'text');
  data.set(TRANSFORM_LOG_KEY, '{broken');
  assert.deepEqual(readTransformLog(storage), []);
  assert.throws(() => appendTransformLog(storage, { ...entry, input: 'x'.repeat(10_001) }));
});
