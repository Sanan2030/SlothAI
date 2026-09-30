import assert from 'node:assert/strict';
import test from 'node:test';
import { appendReviewCase, emptyReviewCorpus, parseReviewCorpus, serializeReviewCorpus,
  type ReviewCase } from '../lib/editor/review-corpus';
import { pickReviewFile, saveReviewToFile, type ReviewFileHandle } from '../lib/ui/review-file';
const row: ReviewCase = { id: 'first', module: 'text', input: 'salam', actual: 'Salam.',
  expected: 'Salam!', preserveFormatting: false, reviewedAt: '2026-09-30T11:00:00.000Z' };
function disk(initial: string, fail = false) {
  let contents = initial, pending = '', writes = 0, aborted = false;
  const handle: ReviewFileHandle = { name: 'slothai-reviewed-tests.json',
    async getFile() { return new File([contents], 'slothai-reviewed-tests.json'); },
    async createWritable() { writes++; return {
      async write(text) { if (fail) throw new Error('disk full'); pending = text; },
      async close() { contents = pending; }, async abort() { aborted = true; },
    }; },
  };
  return { handle, contents: () => contents, writes: () => writes, aborted: () => aborted,
    externalWrite(text: string) { contents = text; } };
}
test('portable corpus retains raw input, generated output, target and options', () => {
  const corpus = appendReviewCase(emptyReviewCorpus(), row);
  assert.deepEqual(parseReviewCorpus(serializeReviewCorpus(corpus)), corpus);
  const changed = appendReviewCase(corpus, { ...row, id: 'new-id', expected: 'Salam, hər vaxtınız xeyir.' });
  assert.equal(changed.cases.length, 1);
  assert.equal(changed.cases[0].id, 'first');
  assert.equal(changed.cases[0].actual, 'Salam.');
  assert.equal(appendReviewCase(changed, { ...row, id: 'mail', module: 'mail', greeting: 'Salam,' }).cases.length, 2);
});
test('disk writes retain all examples and re-read externally updated data', async () => {
  const file = disk('');
  await saveReviewToFile(file.handle, row);
  const external = appendReviewCase(parseReviewCorpus(file.contents()), { ...row, id: 'external', input: 'ikinci' });
  file.externalWrite(serializeReviewCorpus(external));
  await saveReviewToFile(file.handle, { ...row, id: 'third', input: 'ucuncu' });
  assert.equal(parseReviewCorpus(file.contents()).cases.length, 3);
  await saveReviewToFile(file.handle, { ...row, id: 'replacement', expected: 'Salam, dostum!' });
  assert.equal(parseReviewCorpus(file.contents()).cases.length, 3);
  assert.equal(parseReviewCorpus(file.contents()).cases[0].expected, 'Salam, dostum!');
});
test('a newly chosen file can preserve imported older examples', async () => {
  const file = disk('');
  await saveReviewToFile(file.handle, { ...row, id: 'second', input: 'ikinci' }, appendReviewCase(emptyReviewCorpus(), row));
  assert.equal(parseReviewCorpus(file.contents()).cases.length, 2);
});
test('malformed or unrelated existing files are never overwritten', async () => {
  for (const text of ['{', '{"kind":"other","cases":[]}', serializeReviewCorpus({ ...emptyReviewCorpus(), cases: [{ ...row, input: '' }] })]) {
    const file = disk(text);
    await assert.rejects(saveReviewToFile(file.handle, row));
    assert.equal(file.contents(), text);
    assert.equal(file.writes(), 0);
  }
});
test('write failure aborts without replacing the original file', async () => {
  const initial = serializeReviewCorpus(appendReviewCase(emptyReviewCorpus(), row));
  const file = disk(initial, true);
  await assert.rejects(saveReviewToFile(file.handle, { ...row, id: 'second', input: 'ikinci' }), /disk full/);
  assert.equal(file.contents(), initial);
  assert.equal(file.aborted(), true);
});
test('picker is feature-detected and cancellation propagates without saving', async () => {
  assert.equal(pickReviewFile({}), undefined);
  await assert.rejects(pickReviewFile({ showSaveFilePicker: async () => { throw new DOMException('Cancelled', 'AbortError'); } })!, { name: 'AbortError' });
});
