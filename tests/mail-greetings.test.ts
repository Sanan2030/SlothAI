import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEmail } from '../lib/editor/correct';
import { DEFAULT_EMAIL_GREETING, EMAIL_GREETINGS } from '../lib/editor/email-greetings';

test('selected greeting replaces the subject in the mail editor', () => {
  const input = 'movzu: yeni layihe\nhormetli terefdasimiz\nsize teklif gonderirik';
  const output = formatEmail(input, { emailGreeting: DEFAULT_EMAIL_GREETING, omitSubject: true }).text;
  assert.ok(output.startsWith(`${DEFAULT_EMAIL_GREETING}\n\n`));
  assert.ok(!output.includes('Mövzu:'));
  assert.match(output, /təklif/iu);
  const alternative = formatEmail(input, { emailGreeting: EMAIL_GREETINGS[4], omitSubject: true }).text;
  assert.ok(alternative.startsWith(`${EMAIL_GREETINGS[4]}\n\n`));
  assert.notEqual(alternative, output);
});

test('existing callers keep their original subject and invalid greetings are ignored', () => {
  const input = 'movzu: yeni layihe\nsalam\nsize teklif gonderirik';
  assert.match(formatEmail(input).text, /^Mövzu:/u);
  assert.ok(formatEmail(input, { emailGreeting: '<script>', omitSubject: true }).text.startsWith('Salam,'));
});

test('reported browser journal examples retain selection and repair the short mail', () => {
  const input = 'vpn e daxil olmaq barede hec bir problem olmamisdir tesekkurler';
  const options = { emailGreeting: DEFAULT_EMAIL_GREETING, omitSubject: true };
  const output = formatEmail(input, options).text;
  assert.equal(output, 'Salam, hər vaxtınız xeyir.\n\nVPN-ə daxil olmaq barədə heç bir problem olmamışdır. Təşəkkürlər.\n\nHörmətlə,');
  assert.ok(formatEmail(input, { ...options, emailGreeting: 'Hər vaxtınız xeyir.' }).text.startsWith('Hər vaxtınız xeyir.\n\n'));
  const alreadyGreeted = formatEmail(`her vaxtiniz xeyir\n${input}`, options).text;
  assert.equal(alreadyGreeted, output);
});
