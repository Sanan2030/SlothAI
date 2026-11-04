import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { NovelCase } from './evaluate-novel-10000';

export function loadNovelCorpus(directory: string) {
  const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
  const manifest = JSON.parse(readFileSync(`${directory}/MANIFEST.json`, 'utf8'));
  const compressed = readFileSync(`${directory}/cases.jsonl.gz`), raw = gunzipSync(compressed);
  if (hash(compressed) !== manifest.gzipSHA256 || hash(raw) !== manifest.corpusSHA256) throw new Error('Frozen corpus integrity mismatch');
  const rows = raw.toString('utf8').trim().split('\n').map(line => JSON.parse(line) as NovelCase);
  let goldReviewSHA256: string | undefined;
  if (existsSync(`${directory}/GOLD_REVIEW.json`)) {
    const bytes = readFileSync(`${directory}/GOLD_REVIEW.json`), review = JSON.parse(bytes.toString());
    goldReviewSHA256 = hash(bytes);
    if (review.baseCorpusSHA256 !== manifest.corpusSHA256 || review.inputsChanged !== false) throw new Error('Reference review is not bound to frozen inputs');
    const changes = new Map<string, { before: string; after: string }>(review.changes.map((item: { id: string; before: string; after: string }) => [item.id, item]));
    for (const row of rows) {
      const item = changes.get(row.id); if (!item) continue;
      if (item.before !== row.expected || !item.after.trim()) throw new Error('Reference correction precondition mismatch: '+row.id);
      row.expected = item.after;
      if (row.variant === 'identity') row.variant = 'reviewed-reference-spelling';
      changes.delete(row.id);
    }
    if (changes.size) throw new Error('Unknown reference review IDs');
  }
  return { rows, manifest, goldReviewSHA256,
    reviewedTargetsSHA256: hash(rows.map(row => `${row.id}\t${row.expected}`).join('\n')) };
}
