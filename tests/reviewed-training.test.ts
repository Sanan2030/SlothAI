import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedDataset } from '../scripts/nlp/reviewed-data';
import { emptyReviewCorpus } from '../lib/editor/review-corpus';
const row = { id: 'user-case', module: 'text' as const, input: 'sorgu gelib', actual: 'Sorğu gəlib.', expected: 'Sorğu gəlib.', preserveFormatting: false, reviewedAt: '2026-10-02T12:00:00Z' };
const source = (cases: unknown[]) => JSON.stringify({ ...emptyReviewCorpus(), cases });
test('review importer rejects unapproved logs, layout-only mails and evaluation overlap', () => {
  const data = reviewedDataset(source([row, { ...row, id: 'mail', module: 'mail', reviewStatus: 'user-approved' }, { ...row, id: 'overlap', reviewStatus: 'user-approved' }]), 'own private review', 'user', 'private', [row.expected]);
  assert.equal(data.manifest.review.accepted, 0); assert.equal(data.manifest.review.rejected.length, 3);
  assert.throws(() => reviewedDataset(source([row]), '', 'user', 'private'), /provenance/u);
});
test('approved spelling variants share a source cluster and unchanged rows are preserved', () => {
  const data = reviewedDataset(source([{ ...row, reviewStatus: 'user-approved' }, { ...row, id: 'variant', input: 'sorqu gelib', reviewStatus: 'user-approved' }, { ...row, id: 'identity', input: row.expected, reviewStatus: 'user-approved' }]), 'own private review', 'user', 'private');
  assert.equal(data.manifest.review.accepted, 3); assert.equal(data.manifest.documents.length, 1);
  const populated = Object.values(data.partitions).filter(part => part.rows);
  assert.equal(populated.length, 1);
  const rows = populated[0].contents.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.filter(row => row.category === 'identity').length, 1);
  assert.ok(rows.every(row => row.annotationStatus === 'user-attested' && row.reviewedBy === 'user'));
});
test('conflicting homograph targets cannot become training gold', () => {
  const data = reviewedDataset(source([{ ...row, input: 'ac', expected: 'ac', reviewStatus: 'user-approved' }, { ...row, id: 'conflict', input: 'ac', expected: 'aç', reviewStatus: 'user-approved' }]), 'own review', 'user', 'private');
  assert.equal(data.manifest.review.accepted, 0);
  assert.ok(data.manifest.review.rejected.every(item => item.reason.includes('Conflicting')));
});
