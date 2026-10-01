import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseReviewCorpus, MAX_REVIEW_FILE_BYTES } from '../lib/editor/review-corpus';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import type { CorrectionPair } from '../lib/editor/local-ai/paired';

/** Explicit offline opt-in. Saved expected results are never runtime lookups. */
export function reviewedTrainingPairs(filename?: string): CorrectionPair[] {
  if (!filename) return [];
  if (statSync(filename).size > MAX_REVIEW_FILE_BYTES) throw new Error('Reviewed corpus exceeds 25 MB.');
  const corpus = parseReviewCorpus(readFileSync(filename, 'utf8'));
  const groups = new Map<string, CorrectionPair>();
  for (const row of corpus.cases) {
    if (Math.max(tokenize(row.input).length, tokenize(row.expected).length) > 512) {
      throw new Error(`Split long reviewed example into coherent excerpts (512 tokens maximum): ${row.id}`);
    }
    const key = createHash('sha256').update(tokenize(fold(row.input)).map(token => token.word).join(' ')).digest('hex');
    const id = `reviewed-${key}`;
    const previous = groups.get(key);
    if (previous && previous.target !== row.expected) throw new Error(`Conflicting reviewed targets: ${row.id}`);
    groups.set(key, { id, groupId: id, input: row.input, target: row.expected, split: 'train' });
  }
  return [...groups.values()];
}
