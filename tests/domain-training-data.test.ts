import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDomainCorpus, auditDomainOverlap } from '../scripts/nlp/domain-data';
const raw = readFileSync('data/nlp/domain/az-domain-001.json', 'utf8');
test('100 delegated references retain domain balance, ownership and provenance', () => {
  const rows = parseDomainCorpus(raw);
  assert.deepEqual(['train', 'validation', 'test'].map(split => rows.filter(row => row.split === split).length), [80, 10, 10]);
  assert.deepEqual(['it', 'document-workflow', 'public-administration'].map(domain => rows.filter(row => row.domain === domain).length), [35, 35, 30]);
  assert.ok(rows.filter(row => row.input === row.target).length >= 10);
  assert.ok(rows.every(row => row.annotationStatus === 'assistant-reviewed'));
  assert.ok(rows.some(row => row.protectedTerms.includes('API')));
});
test('delegated data cannot become human-certified or lose its independent test set', () => {
  const bad = JSON.parse(raw); bad.cases[0].annotationStatus = 'user-attested';
  assert.throws(() => parseDomainCorpus(JSON.stringify(bad)), /Invalid delegated/);
  const leaked = JSON.parse(raw); leaked.cases.find((row: { split: string }) => row.split === 'test').split = 'train';
  assert.throws(() => parseDomainCorpus(JSON.stringify(leaked)), /80\/10\/10/);
});
test('domain audit rejects normalized duplicates and near-copy references', () => {
  const text = 'Komanda yeni sənədin bütün əlavələrini yoxladı və nəticəni rəhbərə yazılı şəkildə təqdim etdi.';
  assert.throws(() => auditDomainOverlap([{ documentId: 'new', target: text }], [{ documentId: 'old', target: text.toLocaleUpperCase('az-AZ') }]), /duplicates/);
  assert.throws(() => auditDomainOverlap([{ documentId: 'new', target: text.replace('etdi.', 'elədi.') }], [{ documentId: 'old', target: text }]), /duplicates/);
});
test('additional contexts remain distinct from all domain training references', () => {
  const rows = readFileSync('data/nlp/domain/az-domain-001-fresh.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, 24);
  auditDomainOverlap(rows, parseDomainCorpus(raw));
});
