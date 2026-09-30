import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, atomicWriteSync } from '../scripts/atomic-files.mjs';

test('training and dictionary readers see complete JSON during concurrent artifact replacement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sloth-artifacts-'));
  const path = join(directory, 'model.json');
  const first = JSON.stringify({ version: 1, words: Array(10000).fill('şəhər') });
  const second = JSON.stringify({ version: 2, words: Array(10000).fill('səhər') });
  try {
    atomicWriteSync(path, first);
    await Promise.all([
      (async () => { for (let i = 0; i < 20; i++) await atomicWrite(path, i % 2 ? first : second); })(),
      (async () => {
        for (let i = 0; i < 60; i++) {
          const text = await readFile(path, 'utf8');
          assert.ok(text === first || text === second);
          assert.equal(JSON.parse(text).words.length, 10000);
        }
      })(),
    ]);
    assert.deepEqual(await readdir(directory), ['model.json']);
    await assert.rejects(atomicWrite(join(directory, 'missing', 'model.json'), first));
    assert.ok([first, second].includes(await readFile(path, 'utf8')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
