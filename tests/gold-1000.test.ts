import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import gold from './fixtures/independent-gold-v2.json';
import additional from './fixtures/additional-gold-200.json';
import rsd from './fixtures/rsd-it-holdout.json';
import mail from './fixtures/email-holdout.json';
import training from '../data/local-ai/pairs.json';
import { correctText, formatEmail } from '../lib/editor/correct';

const inputs = new Map([...rsd, ...mail, ...additional.cases].map(row => [row.id, row.input]));
const targets = [...gold.cases, ...additional.cases];
test('1000 unique, frozen evaluation inputs are separated from training', () => {
  assert.equal(targets.length, 1000);
  assert.equal(inputs.size, 1000);
  assert.equal(new Set([...inputs.values()]).size, 1000);
  assert.equal(additional.cases.filter(row => row.mode === 'text').length, 100);
  assert.equal(additional.cases.filter(row => row.mode === 'email').length, 100);
  const heldOut = new Set(targets.map(row => row.expected));
  for (const row of training.pairs) assert.ok(!heldOut.has(row.target));
});
for (const row of targets) {
  test(`frozen exact output and stable second pass: ${row.id}`, () => {
    const input = inputs.get(row.id)!;
    assert.equal(createHash('sha256').update(input).digest('hex'), row.inputSha256);
    const transform = row.id.startsWith('mail-') || row.id.startsWith('fresh-mail-')
      ? (text: string) => formatEmail(text).text : (text: string) => correctText(text).text;
    const output = transform(input);
    assert.equal(output, row.expected);
    assert.equal(transform(output), output);
  });
}

test('repairs preserve winners, explicit punctuation and same-subject actions', () => {
  for (const text of ['O qalib.', 'Əli qalib.', 'Mən loglara baxdım.',
    'Sənədi yoxlayıb qeydiyyatı tamamlayın.', 'Mən şəhərin sakitliyini sevirəm.']) {
    assert.equal(correctText(text).text, text);
  }
});

test('grammatical speed cues outrank a conflicting local statistical prediction', () => {
  assert.equal(correctText('suret olcen cihazin neticesi saniye ile muqayise edildi').text,
    'Sürət ölçən cihazın nəticəsi saniyə ilə müqayisə edildi.');
  assert.equal(correctText('Surət sənədə əlavə olunub.').text, 'Surət sənədə əlavə olunub.');
});
