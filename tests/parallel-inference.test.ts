import assert from 'node:assert/strict';
import test from 'node:test';
import { applyProposal, createInferenceRunner, proposeEdits, type ModelProposal } from '../lib/editor/inference-cache';
import { ExpertPool, type ExpertWorker } from '../lib/workers/expert-pool';
import type { ExpertRequest, ExpertResponse } from '../lib/workers/expert-protocol';
import { correctText, formatEmail } from '../lib/editor/correct';
import { isEstablishedSurface } from '../lib/editor/lexicon';
import { runExpert } from '../lib/workers/expert-runner';

const proposal = (input: string, output: string, stage: ModelProposal['stage'] = 'log-spelling', revision = 1): ModelProposal => ({
  input, output, stage, revision, edits: proposeEdits(input, output, stage)!,
});
test('arbiter rejects stale revisions, overlap, altered punctuation and protected edits', () => {
  const edit = proposal('sened hazirdir', 'sənəd hazırdır');
  assert.equal(applyProposal(edit, 2, () => true), undefined);
  assert.equal(applyProposal({ ...edit, edits: [...edit.edits, edit.edits[0]] }, 1, () => true), undefined);
  assert.equal(applyProposal(proposal('`sened`', '`sənəd`'), 1, () => true), undefined);
  assert.equal(applyProposal(proposal('https://sened.az', 'https://sənəd.az'), 1, () => true), undefined);
  assert.equal(applyProposal(proposal('sened@example.az', 'sənəd@example.az'), 1, () => true), undefined);
  assert.equal(proposeEdits('salam, sened', 'salam sənəd', 'log-spelling'), undefined);
  assert.equal(applyProposal(edit, 1, () => false), undefined);
  assert.equal(applyProposal(edit, 1, isEstablishedSurface), 'sənəd hazırdır');
});
test('boundary proposals are gap insertions, never punctuation replacement', () => {
  const edit = proposal('hazirdir biz baxdiq', 'hazirdir. biz baxdiq', 'sentence-boundary');
  assert.equal(applyProposal(edit, 1, () => true), edit.output);
  assert.equal(proposeEdits('hazirdir, biz baxdiq', 'hazirdir. biz baxdiq', 'sentence-boundary'), undefined);
  const invalid = { ...edit, edits: [{ start: 3, end: 3, replacement: '.' }] };
  assert.equal(applyProposal(invalid, 1, () => true), undefined);
});
test('exact-context reuse falls back when upstream words change or source changes', () => {
  const edit = proposal('sened hazirdir', 'sənəd hazırdır');
  const { run, stats } = createInferenceRunner({ revision: 1, text: edit.input, proposals: [edit] }, edit.input, isEstablishedSurface);
  assert.equal(run('log-spelling', edit.input, () => { throw new Error('unnecessary inference'); }), edit.output);
  assert.equal(run('log-spelling', 'sənəd hazirdir', () => 'new context'), 'new context');
  assert.equal(run('sentence-boundary', edit.input, () => 'different head'), 'different head');
  assert.equal(stats.reused, 1); assert.equal(stats.recomputed, 2);
  const stale = createInferenceRunner({ revision: 1, text: edit.input, proposals: [edit] }, 'ikinci mətn', () => true);
  assert.equal(stale.run('log-spelling', edit.input, () => 'fallback'), 'fallback');
});
function fake() {
  const requests: ExpertRequest[] = []; let stopped = 0;
  const worker: ExpertWorker = { onmessage: null, onerror: null, onmessageerror: null,
    postMessage: request => { requests.push(request); }, terminate: () => { stopped++; } };
  return { worker, requests, stopped: () => stopped,
    reply: (data: ExpertResponse) => worker.onmessage?.({ data } as MessageEvent<ExpertResponse>) };
}
test('experts dispatch concurrently; rapid typing retains only the latest queued revision', async () => {
  const workers = [fake(), fake()]; let at = 0;
  const pool = new ExpertPool(() => workers[at++].worker);
  pool.prepare('birinci'); pool.prepare('ikinci'); pool.prepare('üçüncü');
  assert.deepEqual(workers.map(item => item.requests.length), [1, 1]);
  for (const item of workers) item.reply({ revision: 1, proposals: [proposal('birinci', 'birinci')] });
  await Promise.resolve();
  assert.equal(pool.snapshot('birinci'), undefined);
  assert.deepEqual(workers.map(item => item.requests[1].text), ['üçüncü', 'üçüncü']);
  for (const item of workers) item.reply({ revision: 3, proposals: [proposal('üçüncü', 'üçüncü', item.requests[1].stage, 3)] });
  await Promise.resolve();
  assert.equal(pool.snapshot('üçüncü')?.proposals.length, 2);
  pool.invalidate(); assert.equal(pool.snapshot('üçüncü'), undefined); pool.dispose();
});
test('expert deadline and failures stop speculation without breaking the final editor', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const workers = [fake(), fake()]; let at = 0;
  const pool = new ExpertPool(() => workers[at++].worker, 20);
  pool.prepare('sened'); context.mock.timers.tick(20); await Promise.resolve();
  assert.equal(pool.snapshot('sened'), undefined); assert.deepEqual(workers.map(item => item.stopped()), [1, 1]);
  assert.equal(correctText('sened hazirdir').text, 'Sənəd hazırdır.');
  pool.dispose();
});
test('bundled experts preserve final text, mail, formatting and second-pass stability', async () => {
  for (const text of ['sorgunun qebul edilmesini tesdiq edirəm', 'sened hazirdir biz onu yoxladiq',
    'Sənəd hazırdır.', 'API endpoint hazirdir database isleyir', 'salam\nsened hazirdir',
    '# sened\n```ts\nconst sened = 1;\n```\nhttps://example.az', '<p>sened hazirdir</p>', 'Salam,\n\nsorguya cavab verildi\n\nHörmətlə,\nƏli']) {
    const proposals = (await Promise.all((['log-spelling', 'sentence-boundary'] as const).map(stage => runExpert({ revision: 1, text, stage })))).flat();
    const { run } = createInferenceRunner({ revision: 1, text, proposals }, text, isEstablishedSurface);
    for (const preserve of [false, true]) {
      const actual = correctText(text, preserve, { inference: run }).text;
      assert.equal(actual, correctText(text, preserve).text, text);
      assert.equal(correctText(actual, preserve).text, actual, text);
    }
    assert.equal(formatEmail(text, {}, { inference: run }).text, formatEmail(text).text, text);
  }
});
