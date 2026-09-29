import assert from 'node:assert/strict';
import test from 'node:test';
import rsd from './fixtures/rsd-it-holdout.json';
import mail from './fixtures/email-holdout.json';
import reviewed from './fixtures/independent-reviewed.json';
import { correctText, formatEmail } from '../lib/editor/correct';

const inputs = new Map([...rsd, ...mail].map(item => [item.id, item.input]));

test('reviewed exact gold cases reference unique, frozen independent inputs', () => {
  assert.equal(rsd.length, 460);
  assert.equal(mail.length, 340);
  assert.equal(inputs.size, 800);
  assert.equal(new Set(reviewed.map(item => item.id)).size, reviewed.length);
  for (const { id, expected } of reviewed) {
    assert.ok(inputs.has(id), id);
    assert.ok(expected.length > 0 && /[.!?]|Hörmətlə/u.test(expected), id);
  }
});

for (const { id, expected } of reviewed) {
  test(`manually reviewed output: ${id}`, () => {
    const input = inputs.get(id)!;
    assert.equal(id.startsWith('mail-') ? formatEmail(input).text : correctText(input).text, expected);
  });
}
