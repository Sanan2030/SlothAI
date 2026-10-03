import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { checksum } from '../scripts/nlp/data';
import { verifyManifest } from '../scripts/nlp/manifest';

const splits = ['train', 'validation', 'test'] as const;
function fixture(directory: string, prefix: string, texts: string[], approval = true) {
  mkdirSync(directory, { recursive: true });
  const documents = splits.map((split, at) => ({ documentId: `${prefix}-${at}`, cluster: `${prefix}-${at}`, split }));
  const partitions = Object.fromEntries(splits.map((split, at) => {
    const row = { ...documents[at], id: `${prefix}-${at}`, input: texts[at].replaceAll('ə', 'e'), target: texts[at],
      category: 'reviewed', annotationStatus: approval ? 'user-attested' : 'unreviewed',
      reviewedBy: 'test-reviewer', reviewedAt: '2026-10-03T00:00:00Z' };
    const contents = JSON.stringify(row) + '\n';
    writeFileSync(join(directory, split + '.jsonl'), contents);
    return [split, { rows: 1, sha256: checksum(contents) }];
  }));
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ version: 2, documents, partitions }));
}
const sourceTexts = [
  'Məktəbin kitabxanası yeni dərsliklərlə təmin edildi.',
  'Kənd təsərrüfatında su ehtiyatlarının qorunması vacibdir.',
  'Rəssam sərgidə yeni əsərlərini təqdim etdi.',
];
const reviewTexts = [
  'Sənədləri diqqətlə yoxlayıb şirkətin rəhbərinə göndərdik.',
  'Qatarın yola düşmə vaxtını bilet kassasında öyrəndim.',
  'Uşaqlar axşam parkda velosiped sürürdülər.',
];
function run(source: string, reviews: string, output: string) {
  return execFileSync(process.execPath, ['--import', 'tsx', resolve('scripts/build-reviewed-neural-data.ts'),
    `--source=${source}`, `--reviews=${reviews}`, `--output=${output}`], { encoding: 'utf8', stdio: 'pipe' });
}

test('review augmentation stays in train, deduplicates pairs and is reproducible', () => {
  const root = mkdtempSync(join(tmpdir(), 'slothai-reviewed-data-'));
  try {
    const source = join(root, 'source'), reviews = join(root, 'reviews'), first = join(root, 'first'), second = join(root, 'second');
    fixture(source, 'source', sourceTexts); fixture(reviews, 'review', reviewTexts);
    run(source, reviews, first); run(source, reviews, second);
    const manifest = verifyManifest(first);
    assert.equal(manifest.partitions.validation.rows, 2);
    assert.equal(manifest.partitions.test.rows, 2);
    const train = readFileSync(join(first, 'train.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.ok(train.some(row => row.category === 'identity' && row.documentId === 'review-0'));
    assert.ok(train.some(row => row.category === 'swap' && row.target === reviewTexts[0]));
    assert.equal(new Set(train.map(row => row.input + '\n' + row.target)).size, train.length);
    for (const split of [...splits, 'manifest']) assert.equal(readFileSync(join(first, split + (split === 'manifest' ? '.json' : '.jsonl')), 'utf8'),
      readFileSync(join(second, split + (split === 'manifest' ? '.json' : '.jsonl')), 'utf8'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('review augmentation rejects cross-source leakage and unapproved targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'slothai-reviewed-leak-'));
  try {
    const source = join(root, 'source'), reviews = join(root, 'reviews');
    fixture(source, 'source', sourceTexts);
    fixture(reviews, 'review', [reviewTexts[0], reviewTexts[1], sourceTexts[0]]);
    assert.throws(() => run(source, reviews, join(root, 'leak')), /Cross-source target leakage/);
    fixture(reviews, 'review', reviewTexts, false);
    assert.throws(() => run(source, reviews, join(root, 'unreviewed')), /requires explicit user approval/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
