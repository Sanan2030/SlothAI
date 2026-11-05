import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import info from '../lib/editor/punctcase/model-info.json';
import weights from '../lib/editor/punctcase/weights.json';
import golden from './fixtures/punctcase-golden.json';
import { decodePunctCase, loadPunctCase } from '../lib/editor/punctcase/load';
import { editWithPunctCase, editPunctCaseDocument, initialPunctCaseStats } from '../lib/editor/punctcase/edit';
import { automaticPunctCase } from '../lib/strategies/punctcase';
import { correctText } from '../lib/editor/correct';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
import { POST } from '../app/api/transform/route';
import { NextRequest } from 'next/server';

test('PunctCase export is the completed checkpoint with exact original float32 weights', async () => {
  const bytes = Buffer.from(weights.data, 'base64');
  assert.equal(bytes.length, info.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), info.sha256);
  assert.equal(info.sourceCheckpointSHA256, '028592bc1db1843f15e73d3eb97d1fc6c69b9e2b7462e46fa9059582bf03c543');
  assert.equal(info.sourceCheckpointSHA256, golden.sourceCheckpointSHA256);
  assert.equal(info.parameters, 39434);
  assert.equal(await loadPunctCase(), await loadPunctCase());
});

test('PunctCase JavaScript logits match packed-batch PyTorch within 1e-3', async () => {
  const model = await loadPunctCase();
  let maximum = 0, compared = 0;
  for (const fixture of golden.examples) {
    const actual = model.predict(fixture.words);
    for (const head of ['punctuation', 'case'] as const) {
      for (let at = 0; at < fixture.words.length; at++) {
        for (let label = 0; label < fixture[head][at].length; label++) {
          const difference = Math.abs(actual[head][at][label] - fixture[head][at][label]);
          maximum = Math.max(maximum, difference); compared++;
          assert.ok(difference <= 1e-3, `${head} token ${at}: ${difference}`);
        }
      }
    }
  }
  assert.ok(compared > 1000);
  console.log(JSON.stringify({ punctCaseParityMaximumAbsoluteLogitError: maximum, compared }));
  assert.deepEqual(model.predict([]), { punctuation: [], case: [] });
  assert.throws(() => model.predict(Array(97).fill('salam')), /həddi/u);
});

test('PunctCase rejects truncated and corrupted artifacts', async () => {
  await assert.rejects(decodePunctCase(weights.data.slice(0, -4)), /ölçüsü/u);
  const changed = (weights.data[0] === 'A' ? 'B' : 'A') + weights.data.slice(1);
  await assert.rejects(decodePunctCase(changed), /bütövlüyü/u);
});

function proposed(mark = 1, index = 1) {
  return { predict(words: readonly string[]) {
    return { punctuation: words.map((_, at) => Array.from({ length: 6 }, (_, label) => label === (at === index ? mark : 0) ? 20 : -20)),
      case: words.map(() => [0, 20, 0, 0]) };
  } };
}

test('PunctCase preserves whitespace and existing marks and applies proposals idempotently', () => {
  const source = 'bu  məsələ\t indi araşdırılır';
  const stats = initialPunctCaseStats();
  const result = editWithPunctCase(source, proposed(), stats);
  assert.equal(result, 'bu  məsələ,\t indi araşdırılır');
  assert.equal(stats.applied, 1);
  assert.equal(editWithPunctCase(result, proposed(), initialPunctCaseStats()), result);
  const sentence = editWithPunctCase('bu məsələ indi araşdırılır', proposed(2), initialPunctCaseStats());
  assert.equal(sentence, 'bu məsələ. İndi araşdırılır');
  assert.equal(editWithPunctCase(sentence, proposed(2), initialPunctCaseStats()), sentence);
  assert.equal(editWithPunctCase('bu məsələ? indi araşdırılır', proposed(2), initialPunctCaseStats()), 'bu məsələ? indi araşdırılır');
});

test('PunctCase proposals cannot edit literals, identifiers, structure or signatures', async () => {
  for (const source of ['bu API indi işləyir', 'bu user_id indi işləyir', 'bu https://example.com/api?v=2 indi işləyir',
    'bu `const x=1` indi işləyir', '<p>bu məsələ indi araşdırılır</p>', '1. bu məsələ indi araşdırılır',
    'bu məse\u0308lə indi araşdırılır', 'Hörmətlə,\nSənan Məmmədov layihə rəhbəri',
    '**bu məsələ indi araşdırılır**', '> bu məsələ indi araşdırılır', '[bu məsələ indi araşdırılır](/guide)']) {
    assert.equal(editWithPunctCase(source, proposed(), initialPunctCaseStats()), source);
  }
  for (const input of ['**qeyd edək ki bu məsələ hələ araşdırılır**', '> qeyd edək ki bu məsələ hələ araşdırılır',
    '[qeyd edək ki bu məsələ hələ araşdırılır](/guide)']) {
    const strategy = getStrategyRegistry().get('text-corrector');
    const result = await strategy.transform({ text: input });
    assert.ok(result.transformedText.includes('ki, bu məsələ'));
    assert.equal(result.metadata.punctCase?.loaded, true);
    assert.ok((result.metadata.punctCase?.tokens ?? 0) >= 7);
  }
});

test('PunctCase covers long input with bounded overlapping windows without losing tokens', () => {
  const lengths: number[] = [];
  const fake = { predict(words: readonly string[]) { lengths.push(words.length); return proposed(2, words.length - 1).predict(words); } };
  const source = Array(200).fill('salam').join(' '), stats = initialPunctCaseStats();
  assert.equal(editWithPunctCase(source, fake, stats), source);
  assert.ok(lengths.every(size => size <= 96));
  assert.equal(stats.tokens, 200);
  assert.equal(stats.inferenceTokens, lengths.reduce((sum,size) => sum+size,0));
  const words = Array(200).fill('salam'); words[95] = 'qeyd'; words[96] = 'edək';
  const seam = { predict(values: readonly string[]) { return {
    punctuation: values.map(word => word === 'qeyd' ? [0,20,-20,-20,-20,-20] : [20,0,-20,-20,-20,-20]),
    case: values.map(() => [20,0,0,0]),
  }; } };
  const covered = initialPunctCaseStats();
  assert.equal(editWithPunctCase(words.join(' '), seam, covered), words.join(' ').replace('qeyd edək','qeyd, edək'));
  assert.equal(covered.applied,1);
});

test('PunctCase automatically evaluates prose with existing punctuation', async () => {
  const baseline = { text: 'Bu məsələ indi araşdırılır.', corrections: 1 };
  const stable = () => { throw new Error('Must not run for an unchanged proposal'); };
  const result = await automaticPunctCase('Bu məsələ indi araşdırılır.', baseline, stable);
  assert.equal(result.correction, baseline); assert.equal(result.stats.loaded, true);
  assert.equal(result.stats.mode, 'automatic'); assert.equal(result.stats.tokens, 4);
});

test('both application strategies run both models without options; legacy false cannot disable them', async () => {
  for (const id of ['text-corrector', 'gmail-corrector']) {
    const strategy = getStrategyRegistry().get(id), text = 'mən bu gün məktəbə getdim';
    const baseline = await strategy.transform({ text });
    assert.equal(baseline.metadata.punctCase?.mode, 'automatic');
    assert.equal(baseline.metadata.wordLM?.mode, 'automatic');
    assert.equal(baseline.metadata.wordLM?.vocabularyWords, 150000);
    assert.ok((baseline.metadata.wordLM?.scoredTokens ?? 0) > 0);
    const enhanced = await strategy.transform({ text, options: { usePunctCase: false } });
    assert.equal(enhanced.metadata.punctCase?.loaded, true);
    assert.ok((enhanced.metadata.punctCase?.tokens ?? 0) > 0);
    assert.equal(enhanced.transformedText, baseline.transformedText);
  }
});

test('HTTP API always returns both model receipts and validates legacy options', async () => {
  const request = (option: unknown) => new NextRequest('http://localhost/api/transform', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': 'punctcase-contract' },
    body: JSON.stringify({ strategyId: 'text-corrector', text: 'mən bu gün məktəbə getdim', options: { usePunctCase: option } }) });
  assert.equal((await POST(request('true'))).status, 400);
  const good = await POST(request(true)); assert.equal(good.status, 200);
  const result = await good.json();
  assert.equal(result.metadata.punctCase.sourceCheckpointSHA256, info.sourceCheckpointSHA256);
  assert.equal(result.metadata.punctCase.loaded, true);
  assert.equal(result.metadata.wordLM.mode, 'automatic');
  const legacy = await POST(request(false)); assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).metadata.punctCase.loaded, true);
  for (const payload of [{ strategyId: 'text-corrector', text: '🙂'.repeat(5001) },
    { strategyId: '🙂'.repeat(33), text: 'salam' }]) {
    const response = await POST(new NextRequest('http://localhost/api/transform', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': 'punctcase-utf16-contract' },
      body: JSON.stringify(payload) }));
    assert.equal(response.status, 400);
  }
});

test('the trained checkpoint supplies a missing comma and the result is stable', async () => {
  const strategy = getStrategyRegistry().get('text-corrector');
  const text = 'qeyd edək ki bu məsələ hələ araşdırılır';
  const baseline = correctText(text);
  const enhanced = await strategy.transform({ text });
  assert.equal(baseline.text, 'Qeyd edək ki bu məsələ hələ araşdırılır.');
  assert.equal(enhanced.transformedText, 'Qeyd edək ki, bu məsələ hələ araşdırılır.');
  assert.equal(enhanced.metadata.punctCase?.applied, 1);
  assert.equal((await strategy.transform({ text: enhanced.transformedText })).transformedText,
    enhanced.transformedText);
});

test('an unstable model proposal is rejected as a whole', async () => {
  const source = 'qeyd edək ki bu məsələ hələ araşdırılır';
  const baseline = { text: 'Qeyd edək ki bu məsələ hələ araşdırılır.', corrections: 1 };
  const result = await automaticPunctCase(source, baseline, () => baseline);
  assert.equal(result.correction, baseline);
  assert.equal(result.stats?.proposed, 1);
  assert.equal(result.stats?.applied, 0);
  assert.equal(result.stats?.rejectedUnstable, true);
});

test('automatic document inference preserves opaque content and still corrects neighbouring prose', async () => {
  const strategy = getStrategyRegistry().get('text-corrector');
  const source = 'https://example.com/ki?q=1 qeyd edək ki bu məsələ hələ araşdırılır';
  const result = await strategy.transform({ text: source });
  assert.ok(result.transformedText.includes('https://example.com/ki?q=1'));
  assert.ok(result.transformedText.includes('ki, bu məsələ'));
  const code = '````js\nqeyd edək ki bu məsələ hələ araşdırılır\n````';
  assert.equal(editPunctCaseDocument(code, proposed(), initialPunctCaseStats()), code);
  assert.equal((await strategy.transform({ text: result.transformedText })).transformedText, result.transformedText);
});
