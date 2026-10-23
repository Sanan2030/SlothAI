import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import type { EditorDiagnostic } from '../lib/editor/diagnostics';
import { channelLogScore, experimentalWordLMPolicy } from '../lib/editor/wordlm/selection';
import { wordLMSurfacePenalty } from '../lib/editor/wordlm/runtime';

test('diagnostics do not alter normal correction and explain raw alternatives', () => {
  const events: EditorDiagnostic[] = [];
  const input = 'bu seher gozeldir';
  assert.deepEqual(correctText(input, false, { diagnostics: event => events.push(event) }), correctText(input));
  const choice = events.find(event => event.kind === 'candidates' && event.raw === 'seher');
  assert.ok(choice?.kind === 'candidates');
  for (const word of ['seher', 'səhər', 'şəhər']) assert.ok(choice.candidates.some(row => row.word === word));
  assert.equal(choice.selected, 'şəhər');
  assert.ok(choice.candidates.every(row => Number.isFinite(row.lmLogScore) && Number.isFinite(row.channelLogScore)));
  assert.ok(events.some(event => event.kind === 'stage' && event.source === 'capitalization'));
});

test('rules plus WordLM comparison enables WordLM independently of agreement networks', () => {
  const options = { useLocalModel: false, useObservedChannel: false, useWordLM: true };
  assert.equal(correctText('bu seher gozeldir', false, options).text, 'Bu şəhər gözəldir.');
  assert.equal(correctText('Biz məktubu göndərdi.', false, options).text, 'Biz məktubu göndərdi.');
});

test('experimental ranking preserves raw evidence after preceding spelling repairs', () => {
  const events: EditorDiagnostic[] = [];
  correctText('men bu gun mektebe getdim', false, { wordLMMode: 'experimental', diagnostics: event => events.push(event) });
  const choice = events.find(event => event.kind === 'candidates' && event.raw === 'mektebe');
  assert.ok(choice?.kind === 'candidates');
  assert.equal(choice.current, 'məktəbə');
  assert.ok(choice.candidates.some(row => row.word === 'mektebe' && row.sources.includes('retain-input')));
  assert.ok(choice.candidates.some(row => row.word === 'məktəbə'));
});

test('channel penalizes structural changes more than identity and accent restoration', () => {
  assert.equal(channelLogScore('seher', 'seher', experimentalWordLMPolicy), 0);
  assert.ok(channelLogScore('seher', 'şəhər', experimentalWordLMPolicy) > channelLogScore('seher', 'səhərdən', experimentalWordLMPolicy));
});

test('unseen identity candidates cannot claim the whole unknown-class mass', () => {
  assert.equal(wordLMSurfacePenalty('şəhər'), 0);
  assert.ok(wordLMSurfacePenalty('zzzzzxzzy') > 0);
  assert.equal(correctText('bu seher gozeldir', false, { wordLMMode: 'experimental' }).text, 'Bu şəhər gözəldir.');
});

test('experimental policy rejects malformed thresholds and preserves explicit words', () => {
  assert.throws(() => correctText('bu seher gozeldir', false, { wordLMMode: 'experimental', wordLMPolicy: { ...experimentalWordLMPolicy, minimumMargin: NaN } }));
  for (const input of ['Bu şəhər gözəldir.', 'Bu səhər dəniz sakit idi.', 'API request hazırdır.']) {
    assert.equal(correctText(input, false, { wordLMMode: 'experimental' }).text, correctText(input).text);
  }
});
