import assert from 'node:assert/strict';
import test from 'node:test';
import model from '../lib/editor/neural/model.json';
import artifactJSON from '../lib/editor/neural/attention-model.json';
import independent from '../data/neural/attention-independent.json';
import baseline from '../data/neural/attention-independent-baseline.json';
import corpus from '../data/neural/attention-pairs.json';
import type { PairedModel } from '../lib/editor/local-ai/paired';
import { correctText, formatEmail } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { createNetwork, predictNetwork, trainNetworkStep } from '../lib/editor/neural/network';
import { attend, characterVector, contextKeys, createAttentionNetwork, attentionProbability,
  attentionLexicon, transpositionIndex, rankAttention, attentionParameterCount, trainAttentionStep, trainAttention, tokenPosition, type AttentionArtifact } from '../lib/editor/neural/attention';
import { auditPairs } from '../scripts/neural-data-quality';
const artifact = artifactJSON as AttentionArtifact, lexicon = attentionLexicon(model.lexicon as PairedModel, artifact.vocabulary);
const loss = (p: number, y: number) => -y * Math.log(p) - (1 - y) * Math.log(1 - p);

test('attention artifact is small and datasets have distinct full contexts', () => {
  assert.equal(attentionParameterCount(artifact.network), 1149);
  assert.ok(Buffer.byteLength(JSON.stringify(artifact)) < 50000);
  const quality = auditPairs(corpus.rows);
  assert.deepEqual(quality.duplicates, []); assert.deepEqual(quality.nearDuplicates, []); assert.deepEqual(quality.splitLeaks, []);
});
test('attention weights normalize and relative positions retain token order', () => {
  const network = createAttentionNetwork();
  const left = tokenPosition('Biz müqavilə sənədini diqqətlə oxuduq.', 'müqavilə');
  const keys = contextKeys(left.tokens, left.at), result = attend(network, 'müqavilə', keys);
  assert.ok(Math.abs(result.weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.ok(result.weights.every(value => value > 0 && Number.isFinite(value)));
  assert.notDeepEqual(characterVector('surət'), characterVector('sürət'));
  const reversed = tokenPosition('Diqqətlə sənədini müqavilə Biz oxuduq.', 'müqavilə');
  assert.notDeepEqual(keys, contextKeys(reversed.tokens, reversed.at));
});
test('MLP input gradients match finite differences', () => {
  const network = createNetwork(3, 4, 71), x = [0.3, -0.2, 0.7];
  const analytic = trainNetworkStep(network, x, 1, 0, true), epsilon = 1e-5;
  for (let i = 0; i < x.length; i++) {
    const plus = [...x], minus = [...x]; plus[i] += epsilon; minus[i] -= epsilon;
    const numeric = (loss(predictNetwork(network, plus), 1) - loss(predictNetwork(network, minus), 1)) / (2 * epsilon);
    assert.ok(Math.abs(analytic[i] - numeric) < 1e-7);
  }
});
test('learned attention query gradients match finite differences through softmax pooling', () => {
  const network = createAttentionNetwork(), row = corpus.rows.find(row => row.id === 'attention-073')!;
  const input = { raw: row.raw, candidate: row.expectedWord, ...tokenPosition(row.input, row.raw), y: 1, group: row.id };
  const epsilon = 1e-5, rate = 1e-4, updated = structuredClone(network);
  trainAttentionStep(updated, lexicon, input, rate);
  for (const at of [0, 17, 87, 153, 255]) {
    const plus = structuredClone(network), minus = structuredClone(network);
    plus.query[at] += epsilon; minus.query[at] -= epsilon;
    const numeric = (loss(attentionProbability(plus, lexicon, input), 1) - loss(attentionProbability(minus, lexicon, input), 1)) / (2 * epsilon);
    const analytic = (network.query[at] - updated.query[at]) / rate - 0.0001 * network.query[at];
    assert.ok(Math.abs(analytic - numeric) < 1e-6, `${at}: ${analytic} != ${numeric}`);
  }
});
test('attention training resumes exactly and refuses unbounded requests', () => {
  const rows = corpus.rows.filter(row => row.split === 'train').slice(0, 4).map(row => ({
    raw: row.raw, candidate: row.expectedWord, ...tokenPosition(row.input, row.raw), y: 1, group: row.id }));
  const first = createAttentionNetwork(), second = createAttentionNetwork();
  trainAttention(first, lexicon, rows, 4); trainAttention(second, lexicon, rows, 2);
  const resumed = structuredClone(second); trainAttention(resumed, lexicon, rows, 2);
  assert.deepEqual(first, resumed);
  assert.throws(() => trainAttention(first, lexicon, rows, 201), /bounded/);
});
for (const row of corpus.rows.filter(row => row.split === 'test')) test(`attention development output: ${row.id}`, () => {
  assert.equal(correctText(row.input).text, row.target);
  assert.equal(neuralSpelling(row.input), row.target);
  assert.ok(formatEmail(row.input, { omitSubject: true }).text.includes(row.target));
  assert.equal(correctText(row.target).text, row.target);
});

test('imperative verb roots cannot become transposed adjectives', () => {
  assert.equal(correctText('zehmet olmasa gozle').text, 'Zəhmət olmasa, gözlə.');
  assert.equal(correctText('Zəhmət olmasa, gözlə.').text, 'Zəhmət olmasa, gözlə.');
});
for (const row of independent.rows) test(`independent attention safety: ${row.id}`, () => {
  const old = baseline.rows.find(previous => previous.id === row.id)!;
  const actual = correctText(row.input).text;
  if (old.actual === old.target || row.domain === 'control') assert.equal(actual, row.target);
  const { tokens, at } = tokenPosition(row.input, row.raw);
  const decision = rankAttention(artifact, lexicon, transpositionIndex(lexicon), row.raw, tokens, at);
  if (decision?.accepted) assert.equal(decision.candidate, row.expectedWord);
});
