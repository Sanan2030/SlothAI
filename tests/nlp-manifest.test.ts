import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksum } from '../scripts/nlp/data';
import { verifyManifest, type Manifest } from '../scripts/nlp/manifest';
test('manifest rejects changed content, misassigned documents and cluster leaks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sloth-manifest-'));
  try {
    const line = JSON.stringify({ documentId: 'doc-1', split: 'train', input: 'x', target: 'y' }) + '\n';
    writeFileSync(join(directory, 'train.jsonl'), line);
    for (const split of ['validation', 'test']) writeFileSync(join(directory, split + '.jsonl'), '');
    const manifest: Manifest = { version: 2, documents: [{ documentId: 'doc-1', cluster: 'c1', split: 'train' }],
      partitions: { train: { sha256: checksum(line), rows: 1 }, validation: { sha256: checksum(''), rows: 0 }, test: { sha256: checksum(''), rows: 0 } } };
    const save = () => writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest));
    save(); assert.equal(verifyManifest(directory).version, 2);
    writeFileSync(join(directory, 'train.jsonl'), line + ' '); assert.throws(() => verifyManifest(directory), /checksum/);
    writeFileSync(join(directory, 'train.jsonl'), line); manifest.documents[0].split = 'validation'; save(); assert.throws(() => verifyManifest(directory), /assignment/);
    manifest.documents[0].split = 'train'; manifest.documents.push({ documentId: 'doc-2', cluster: 'c1', split: 'test' }); save(); assert.throws(() => verifyManifest(directory), /cluster/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
