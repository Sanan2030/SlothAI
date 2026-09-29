import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { chooseBySentence, sentenceEvidence } from '../lib/editor/contextual-choices';
import { applyPersonalLexicon, confirmPersonalCandidate, extractPersonalCandidates,
  PERSONAL_LEXICON_KEY, queuePersonalCandidates, readPersonalLexicon, writePersonalLexicon } from '../lib/editor/personal-lexicon';

test('sentence-wide clues disambiguate morning/city and document copy/speed', () => {
  assert.equal(chooseBySentence('seher', sentenceEvidence('Avtomobillər küçələrdə və binaların qarşısında dayanıb, seher böyüyür')), 'şəhər');
  assert.equal(chooseBySentence('seher', sentenceEvidence('Saat altıda oyandım, seher açılır')), 'səhər');
  assert.equal(chooseBySentence('suret', sentenceEvidence('Arxivdə imzalı sənədin suretini saxladıq')), 'surət');
  assert.equal(chooseBySentence('suret', sentenceEvidence('Sənədin suretini arxivə göndərin')), 'surət');
  assert.equal(chooseBySentence('suret', sentenceEvidence('İnternet suret artsa da şəbəkə gecikir')), 'sürət');
  assert.equal(chooseBySentence('seher', sentenceEvidence('seher')), undefined);
  assert.equal(chooseBySentence('seher', sentenceEvidence('seher parkda qaçdım')), undefined);
  assert.equal(chooseBySentence('səhər', sentenceEvidence('küçə və metro')), undefined);
  assert.match(correctText('seher kuce ve binalar ile taninir').text, /^Şəhər\b/u);
});

test('manual word edit remains pending until confirmation and applies only in context', () => {
  const candidates = extractPersonalCandidates('Bu mətn ugurludur.', 'Bu mətn uğurludur.');
  assert.deepEqual(candidates, [{ source: 'ugurludur', target: 'uğurludur', left: 'metn', right: '' }]);
  const pending = queuePersonalCandidates({ pending: [], confirmed: [] }, candidates);
  assert.equal(pending.pending.length, 1);
  assert.equal(applyPersonalLexicon('Bu mətn ugurludur.', pending.confirmed), 'Bu mətn ugurludur.');
  const confirmed = confirmPersonalCandidate(pending, candidates[0]);
  assert.equal(applyPersonalLexicon('Bu mətn ugurludur.', confirmed.confirmed), 'Bu mətn uğurludur.');
  assert.equal(applyPersonalLexicon('Bu qərar ugurludur.', confirmed.confirmed), 'Bu qərar ugurludur.');
  assert.deepEqual(extractPersonalCandidates('Bu mətn yaxşıdır.', 'Tamamilə yeni fikir.'), []);
  assert.deepEqual(extractPersonalCandidates('Bu mətn yaxşıdır.', 'Bu mətn yaxşıdır.'), []);
});

test('local storage round trip is bounded and markup is protected', () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (name: string) => memory.get(name) ?? null,
    setItem: (name: string, value: string) => { memory.set(name, value); } };
  const candidate = { source: 'yanlis', target: 'yanlış', left: 'bu', right: '' };
  assert.equal(writePersonalLexicon(storage, { pending: [], confirmed: [candidate] }), true);
  assert.ok(memory.has(PERSONAL_LEXICON_KEY));
  const restored = readPersonalLexicon(storage);
  assert.deepEqual(restored.confirmed, [candidate]);
  assert.equal(applyPersonalLexicon('Bu yanlis söz. <span>Bu yanlis</span> `Bu yanlis`', restored.confirmed),
    'Bu yanlış söz. <span>Bu yanlış</span> `Bu yanlis`');
  memory.set(PERSONAL_LEXICON_KEY, '{not JSON');
  assert.deepEqual(readPersonalLexicon(storage), { pending: [], confirmed: [] });
});
