import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';

test('initials and surnames retain original punctuation and spacing in both modules', () => {
  for (const name of ['M.Füzuli', 'H.Cavid', 'A. Əliyev', 'R.M.Məmmədov']) {
    const input = `${name} adına məktəb fəaliyyətdədir.`;
    assert.equal(correctText(input).text, input);
    assert.ok(formatEmail(input, { omitSubject: true }).text.includes(input));
  }
});

test('initial-name protection does not turn ordinary sentence endings into initials', () => {
  const input = 'Məktəb açıldı. Yeni dərslər başladı.';
  assert.equal(correctText(input).text, input);
  assert.equal(correctText('`M.Fuzuli` https://example.com/M.Fuzuli').text,
    '`M.Fuzuli` https://example.com/M.Fuzuli.');
});
