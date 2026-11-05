import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { restoreWord } from '../lib/editor/lexicon';
import { languageServices } from '../lib/editor/language-services';
import { restoreRepeatedKey } from '../lib/editor/wordlm/lexical-evidence';
import { repairObservedSpacing } from '../lib/editor/observed-channel';
import { resolveEntitiesInText } from '../lib/editor/entities/resolver';
import { guardInsertedBoundaries } from '../lib/editor/syntax-boundary-guard';
import { parseEmailSections } from '../lib/editor/rules/email';
import { detectQuestion } from '../lib/editor/punctuation';
import { contextualOrthography } from '../lib/editor/contextual-orthography';
import { loadNovelCorpus } from '../scripts/qa/corpus';
import { restoreReviewedVerb } from '../lib/editor/reviewed-verb-forms';
import { correctText } from '../lib/editor/correct';

test('new source-attested whole forms restore accents without changing homograph choice', () => {
  assert.equal(restoreWord('vurgulanir', languageServices), 'vurğulanır');
  assert.equal(restoreWord('fotoseklin', languageServices), 'fotoşəklin');
  assert.equal(restoreWord('hayata', languageServices), 'həyata');
  assert.equal(restoreWord('paromdan', languageServices), 'paromdan');
  assert.equal(restoreWord('sürəti', languageServices), 'sürəti');
  assert.equal(restoreWord('surəti', languageServices), 'surəti');
  assert.equal(restoreWord('şərt', languageServices), 'şərt');
  assert.equal(restoreWord('şərti', languageServices), 'şərti');
  assert.equal(restoreReviewedVerb('çekin'), undefined);
  assert.equal(restoreReviewedVerb('cekilen'), 'çəkilən');
  assert.equal(restoreReviewedVerb('sayilmadigi'), 'sayılmadığı');
});

test('one repeated key needs a unique whole-word candidate and preserves true doubles', () => {
  assert.equal(restoreWord('olmaadığı', languageServices), 'olmadığı');
  assert.equal(restoreRepeatedKey('müəyyən', () => false), undefined);
  assert.equal(restoreRepeatedKey('müəllim', () => false), undefined);
  assert.equal(restoreRepeatedKey('kabellə', () => false), undefined);
  assert.equal(restoreRepeatedKey('aabbcc', word => new Set(['abbcc', 'aabcc']).has(word)), undefined);
  assert.equal(restoreRepeatedKey('HTTPP', () => false), undefined);
});

test('glued conjunction splits after a verified finite verb but preserves whole words', () => {
  assert.equal(repairObservedSpacing('Ölçü götürülürvə nəticə yazılır.'), 'Ölçü götürülür və nəticə yazılır.');
  assert.equal(repairObservedSpacing('Nüvə və meyvə ayrıca sözlərdir.'), 'Nüvə və meyvə ayrıca sözlərdir.');
  assert.equal(repairObservedSpacing('myValue və HTTP dəyişmir.'), 'myValue və HTTP dəyişmir.');
});

test('entity inference cannot turn a common clock/case into a guessed place', () => {
  assert.equal(resolveEntitiesInText('Qəbul saatının dəyişməsi barədə soruşun.'), 'Qəbul saatının dəyişməsi barədə soruşun.');
  assert.equal(resolveEntitiesInText('Səki örtüyünü dəyişin.'), 'Səki örtüyünü dəyişin.');
  assert.equal(resolveEntitiesInText('Şəkidən qayıtdıq.'), 'Şəkidən qayıtdıq.');
  assert.equal(resolveEntitiesInText('amma eli qaldi'), 'amma Əli qaldi');
  assert.equal(resolveEntitiesInText('Onun əli sarğıdadır.'), 'Onun əli sarğıdadır.');
});

test('a participial noun modifier vetoes only a newly inserted boundary', () => {
  const source = 'İmzalanacaq sənədin nüsxəsini saxlayın.';
  assert.equal(guardInsertedBoundaries(source, 'İmzalanacaq. sənədin nüsxəsini saxlayın.'), source);
  const explicit = 'Sənəd imzalanacaq. Komanda gözləyir.';
  assert.equal(guardInsertedBoundaries(explicit, explicit), explicit);
  assert.equal(guardInsertedBoundaries('Sənəd imzalanacaq komanda gözləyir.', 'Sənəd imzalanacaq. komanda gözləyir.'), 'Sənəd imzalanacaq. komanda gözləyir.');
});

test('an already complete greeting paragraph cannot consume a customer noun in the body', () => {
  const body = 'Köhnə müştəri gec cavabı qəbul etmir.';
  assert.equal(parseEmailSections(`Salam,\n\n${body}\n\nHörmətlə,\nRəna Məmmədli`).body, body);
  assert.equal(parseEmailSections('salam leyla xanim yenilənmiş cədvəli göndərin hormetle komanda').body, 'yenilənmiş cədvəli göndərin');
});

test('direct doğrudanmı is interrogative and an embedded report remains declarative', () => {
  assert.equal(detectQuestion('Doğrudanmı dəyişiklik qüvvəyə minir'), true);
  assert.equal(detectQuestion('Onun doğrudanmı gəldiyini bilmirəm.'), false);
  assert.equal(detectQuestion('Faizin hansı əsas məbləğə tətbiqi açıq yazılır.'), false);
  assert.equal(detectQuestion('Hansı əsas məbləğə faiz tətbiq edilir'), true);
});

test('local terminology separates copy and speed while retaining explicit senses', () => {
  assert.equal(contextualOrthography('Sənədin sureti göndərilir.', 'Senedin sureti gonderilir.'), 'Sənədin surəti göndərilir.');
  assert.equal(contextualOrthography('Yazı sureti ölçülür.', 'Yazi sureti olculur.'), 'Yazı sürəti ölçülür.');
  assert.equal(contextualOrthography('Əli acıqlanır.', 'Əli acıqlanır.'), 'Əli acıqlanır.');
  assert.equal(contextualOrthography('Adi günün sürəti başqa cürdür.', 'Adi günün sürəti başqa cürdür.'), 'Adi günün sürəti başqa cürdür.');
  assert.equal(contextualOrthography('Seher parkında yol açılır.', 'Seher parkında yol açılır.'), 'Şəhər parkında yol açılır.');
  assert.equal(contextualOrthography('Səhər parkında yol açılır.', 'Səhər parkında yol açılır.'), 'Səhər parkında yol açılır.');
  assert.equal(contextualOrthography('Meyarı tapşırıqdan əvvəl acıqlanır.', 'Meyari tapsiriqdan evvel aciqlanir.'), 'Meyarı tapşırıqdan əvvəl açıqlanır.');
  const once = correctText('Yazı sureti uçun əlavə vaxt ayrılır.').text;
  assert.equal(once, 'Yazı sürəti üçün əlavə vaxt ayrılır.');
  assert.equal(correctText(once).text, once);
});

test('the 10,000-case development corpus is frozen and proves measured legacy separation', () => {
  const root = 'data/qa/novel-10000-2026-11-04', manifest = JSON.parse(readFileSync(`${root}/MANIFEST.json`, 'utf8'));
  const compressed = readFileSync(`${root}/cases.jsonl.gz`), raw = gunzipSync(compressed);
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(compressed), manifest.gzipSHA256); assert.equal(sha(raw), manifest.corpusSHA256);
  const rows = raw.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, 10000); assert.equal(new Set(rows.map(row => row.input)).size, 10000);
  assert.equal(new Set(rows.map(row => row.expected)).size, 10000);
  assert.equal(manifest.runtimeOutputsUsedToAuthorTargets, false);
  assert.equal(manifest.novelty.normalizedExactOverlap, 0); assert.equal(manifest.novelty.sharedEightWordSequence, 0);
  assert.ok(manifest.novelty.maximumAcceptedTrigramJaccard < manifest.novelty.trigramJaccardLimit);
  const approved = loadNovelCorpus(root), review = JSON.parse(readFileSync(`${root}/GOLD_REVIEW.json`, 'utf8'));
  assert.equal(review.changes.length, 23); assert.equal(review.inputsChanged, false);
  assert.equal(approved.rows.length, 10000);
  for (const change of review.changes) {
    const before = rows.find(row => row.id === change.id), after = approved.rows.find(row => row.id === change.id);
    assert.equal(before.expected, change.before); assert.equal(after?.expected, change.after);
    assert.equal(after?.input, before.input);
    assert.match(change.reason, /unutmaq|unutulmuş/u);
  }
});
