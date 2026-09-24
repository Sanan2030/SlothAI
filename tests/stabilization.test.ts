import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { correctText, formatEmail, MAX_TEXT_LENGTH, type CorrectionEvent } from '../lib/editor/correct';
import { languageServices } from '../lib/editor/language-services';
import { POST } from '../app/api/transform/route';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';

test('spelling service is replaceable on the actual production path without global mutation', () => {
  const events: CorrectionEvent[] = [];
  const services = { ...languageServices, spelling: { resolve: (word: string) => word === 'demo' ? 'nümunə' : word } };
  assert.equal(correctText('demo', false, { services, trace: event => events.push(event) }).text, 'Nümunə.');
  assert.equal(events.length, 1);
  assert.equal(events[0].replacement, 'nümunə');
  assert.equal(correctText('demo').text, 'Demo.');
});

test('lemma and morphology replacements influence production spelling', () => {
  const lemmaDictionary = { ...languageServices.lemmaDictionary,
    getByLemma: () => undefined, hasSurfaceForm: () => false,
    findByFoldedForm: (word: string) => ({ query: word, normalized: word, entries: [{ lemma: 'zəfəz', source: 'dictionary' as const }] }) };
  assert.equal(correctText('zefez', false, { services: { ...languageServices, lemmaDictionary } }).text, 'Zəfəz.');
  const morphology = { ...languageServices.morphology,
    generateForms: () => [], stripSuffixes: () => [], isValidWordForm: () => true,
    analyzeWord: () => [{ surface: 'zəfəz', lemma: 'zəf', features: {}, source: 'rule' as const }] };
  assert.equal(correctText('zefez', false, { services: { ...languageServices, morphology } }).text, 'Zəfəz.');
});

test('placeholder-like input never restores an unintended protected value', () => {
  for (let n = 1; n <= 30; n++) {
    const unusual = '\uE000'.repeat(n) + '0\uE001';
    const spans = ['`const x = 1;`', 'https://example.com/a?x=1', 'test@example.com'];
    const result = correctText([unusual, ...spans].join(' ')).text;
    assert.ok(result.includes(unusual));
    for (const span of spans) assert.ok(result.includes(span));
    assert.ok(!result.includes('undefined'));
  }
});

test('API validates hostile and malformed inputs and matches both direct strategies', async () => {
  let id = 0;
  const request = (body: string) => new NextRequest('http://localhost/api/transform', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `test-${id++}` }, body });
  for (const [body, status] of [
    ['{', 400], [JSON.stringify({ strategyId: 'text-corrector', text: '' }), 400],
    [JSON.stringify({ strategyId: 'text-corrector', text: 'a'.repeat(MAX_TEXT_LENGTH + 1) }), 400],
    [JSON.stringify({ strategyId: '__proto__', text: 'salam' }), 404],
  ] as const) assert.equal((await POST(request(body))).status, status);
  for (const strategyId of ['text-corrector', 'gmail-corrector']) {
    const text = 'salam melumat hazirdir';
    const direct = await getStrategyRegistry().get(strategyId).transform({ text });
    const response = await POST(request(JSON.stringify({ strategyId, text })));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).transformedText, direct.transformedText);
  }
  assert.throws(() => formatEmail('a'.repeat(MAX_TEXT_LENGTH + 1)));
});

test('generated dictionary reproduces byte-for-byte', () => {
  const paths = ['lib/editor/generated/az-words.json', 'public/dictionaries/az/metadata.json'];
  const hashes = () => paths.map(path => createHash('sha256').update(readFileSync(path)).digest('hex'));
  const before = hashes();
  execFileSync(process.execPath, ['scripts/import-dictionary.mjs', 'public/dictionaries/az'], { stdio: 'pipe' });
  assert.deepEqual(hashes(), before);
});

test('FLAG long parsing and restricted suffix semantics', async () => {
  // The importer is a build-time JS module, intentionally absent from browser code.
  const modulePath = '../scripts/hunspell.mjs';
  const { splitLongFlags, parseSuffixRules } = await import(modulePath);
  assert.deepEqual(splitLongFlags('N1O2'), ['N1', 'O2']);
  assert.throws(() => splitLongFlags('N'));
  const parsed = parseSuffixRules('FLAG long\nSFX N1 Y 3\nSFX N1 q ğa q\nSFX N1 0 lar .\nSFX N1 0 lı/A1 .\nSFX O2 0 sinə');
  assert.equal(parsed.rules.get('N1').length, 2);
  assert.equal(parsed.skippedRules, 2);
  const rule = parsed.rules.get('N1')[0];
  const word = 'otaq';
  assert.match(word, new RegExp(rule.condition + '$'));
  assert.equal(word.slice(0, -rule.strip.length) + rule.add, 'otağa');
});
