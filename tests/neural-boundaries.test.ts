import assert from 'node:assert/strict';
import test from 'node:test';
import modelJSON from '../lib/editor/neural/sentence-boundary-model.json';
import { insertNeuralBoundaries, verifyBoundaryArtifact } from '../lib/editor/neural/boundary-runtime';
import { prepareBoundaryContext, eligibleBoundary, boundaryFeatures, BOUNDARY_INPUTS,
  type NeuralBoundaryArtifact } from '../lib/editor/neural/boundary-features';
import { newFalseEditRows } from '../scripts/nlp/metrics';

test('boundary features use original offsets, fixed dimensions and no capitalization signal', () => {
  const a = prepareBoundaryContext('Sənəd bitdi komanda yeni işə başladı');
  const b = prepareBoundaryContext('sənəd bitdi komanda yeni işə başladı');
  assert.equal(boundaryFeatures(a, 1).length, BOUNDARY_INPUTS);
  assert.deepEqual(boundaryFeatures(a, 1), boundaryFeatures(b, 1));
  assert.equal(a.text.slice(a.tokens[1].start, a.tokens[1].end), 'bitdi');
});

test('high neural confidence cannot override subordinate, indirect-question or converb scope', () => {
  const model = structuredClone(modelJSON) as NeuralBoundaryArtifact;
  model.network.w1.fill(0); model.network.b1.fill(0); model.network.w2.fill(0); model.network.b2 = 30;
  for (const input of [
    'Dedi ki sənədi yoxlayıb məlumatı göndərəcək.',
    'Mən bilmirəm o nə vaxt gəlir.',
    'Rəhbər soruşdu kimin işi hazırdır.',
    'Dostuma zəng edib bir az gözləməsini xahiş etdim.',
    'Uşaq kitabı oxuyur və şəkillərə baxır.',
  ]) {
    assert.equal(insertNeuralBoundaries(input, model), input, input);
  }
});

test('the trained head retains explicit punctuation, isolated clauses and protected-looking gaps', () => {
  for (const input of [
    'Məktub göndərildi. Komanda cavab verdi.',
    'Komanda sənədi yoxlayıb qeydiyyatı tamamlayır.',
    'Əgər sənədlər hazırdırsa, bu gün göndərin.',
    'Mən hər səhər məktəbə gedirəm.',
  ]) assert.equal(insertNeuralBoundaries(input), input);
  const context = prepareBoundaryContext('Sənəd bitdi `userId` komanda başladı');
  assert.equal(eligibleBoundary(context, 1), false);
});

test('invalid boundary weights or acceptance contracts fail clearly', () => {
  const dimensions = structuredClone(modelJSON) as NeuralBoundaryArtifact;
  dimensions.network.inputs = 1;
  assert.throws(() => verifyBoundaryArtifact(dimensions), /Unsupported/);
  const permissive = structuredClone(modelJSON) as NeuralBoundaryArtifact;
  permissive.threshold = 0.5;
  assert.throws(() => verifyBoundaryArtifact(permissive), /Unsupported/);
  const nonfinite = structuredClone(modelJSON) as NeuralBoundaryArtifact;
  nonfinite.network.w1[0] = NaN;
  assert.throws(() => verifyBoundaryArtifact(nonfinite), /Unsupported/);
});

test('regression comparison detects a new wrong edit despite a different correct repair', () => {
  const row = { id: 'x', input: 'sened hazirdi', target: 'sənəd hazırdır', category: 'spelling' };
  assert.deepEqual(newFalseEditRows([{ ...row, actual: 'sened hazirdi' }], [{ ...row, actual: 'sənəd hazırlı' }]), ['x']);
  assert.deepEqual(newFalseEditRows([{ ...row, actual: 'sened hazirdi' }], [{ ...row, actual: 'sənəd hazırdır' }]), []);
  assert.throws(() => newFalseEditRows([{ ...row, actual: row.input }], [{ ...row, id: 'y', actual: row.target }]), /not aligned/);
});


test('boundary corpus keeps document ownership and rejects duplicate or near-duplicate references', async () => {
  const { boundaryRows, auditBoundaryDocuments } = await import('../scripts/nlp/sentence-boundary-data');
  const documents = [
    { documentId: 'a', text: 'Sənəd bitdi. Komanda yeni işə başladı.', split: 'train' as const, source: 'test fixture' },
    { documentId: 'b', text: 'Məktub göndərildi. Müştəri cavab verdi.', split: 'test' as const, source: 'test fixture' },
  ];
  auditBoundaryDocuments(documents);
  const first = boundaryRows(documents), second = boundaryRows(documents);
  assert.deepEqual(first, second);
  assert.ok(first.rows.some(row => row.y === 1));
  for (const row of first.rows) assert.equal(row.split, documents.find(doc => doc.documentId === row.documentId)!.split);
  assert.throws(() => auditBoundaryDocuments([documents[0], { ...documents[0], documentId: 'c', split: 'test' }]), /leaks/);
  assert.throws(() => auditBoundaryDocuments([documents[0], { ...documents[0], split: 'test' }]), /Duplicate/);
  const long = 'Komanda bu gün təqdim olunan bütün sənədləri diqqətlə yoxladı və nəticələri müştəriyə göndərdi.';
  assert.throws(() => auditBoundaryDocuments([
    { ...documents[0], text: long }, { ...documents[1], text: long.replace('göndərdi', 'çatdırdı') },
  ]), /Near-duplicate/);
});
