import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BrowserWordLM, wordLMTokens } from '../lib/editor/wordlm/core';
import artifact from '../lib/editor/wordlm/model.json';
import report from '../docs/training/wordlm-browser-2026-10-17.json';
import { chooseWordLMSpelling } from '../lib/editor/wordlm/runtime';
import { correctText } from '../lib/editor/correct';

const model = new BrowserWordLM(artifact);
test('browser artifact is bound to the completed full model and bounded export', () => {
  assert.equal(createHash('sha256').update(readFileSync('lib/editor/wordlm/model.json')).digest('hex'), report.artifactSHA256);
  assert.equal(artifact.sourceModelSHA256, report.sourceModelSHA256);
  assert.equal(report.trainRows, 3287357);
  assert.equal(report.validationRows, 1082532);
  assert.equal(report.fullModelZeroProbabilityTokens, 0);
  assert.ok(Number.isFinite(report.fullModelValidationPerplexity));
  assert.equal(artifact.bigrams.length, 20000);
  assert.equal(artifact.trigrams.length, 40000);
  assert.ok(report.artifactBytes < 9_000_000);
  assert.ok(report.gzipBytes < 2_000_000);
});

test('all retained histories transfer removed mass to normalized backoff', () => {
  assert.ok(Math.abs(artifact.unigrams.reduce((a,b) => a+b,0)-1) < 1e-10);
  for (const [contexts, entries] of [[artifact.contexts2,artifact.bigrams],[artifact.contexts3,artifact.trigrams]]) {
    const sums = new Map<string, number>();
    for (const row of entries) {
      const key=row.slice(0,-2).join(':');
      assert.ok(row.at(-1)! > 0 && row.at(-1)! <= 1);
      sums.set(key,(sums.get(key)??0)+row.at(-1)!);
    }
    for (const row of contexts) {
      assert.ok(row.at(-1)! >= 0 && row.at(-1)! <= 1);
      assert.ok(Math.abs((sums.get(row.slice(0,-1).join(':'))??0)+row.at(-1)!-1)<1e-12);
    }
  }
});

test('Azerbaijani normalization and suffix OOV mapping match the training conventions', () => {
  assert.deepEqual(wordLMTokens('İŞ IŞIQ, go\u0308z! 42 kod_1'), ['iş','ışıq','göz','kod']);
  assert.deepEqual(wordLMTokens('Ⅳ ² ١٢ 42 x_1'), ['ⅳ','²','x']);
  const unknown='zzzzzzlərdən';
  assert.equal(model.mapped(unknown), model.mapped('<suffix:lərdən>'));
  assert.equal(model.mapped('zzzzzzzz'), model.mapped('<unk>'));
  assert.ok(model.probability(model.mapped('<s>'),model.mapped('<s>'),model.mapped('zzzzzzzz'))>0);
});

test('unseen histories back off exactly to continuation unigrams', () => {
  const id=model.mapped('məktəb');
  assert.equal(model.probability(-1,-1,id),artifact.unigrams[id]);
});

test('contextual ranking resolves an unknown ASCII ambiguity with learned evidence', () => {
  assert.equal(chooseWordLMSpelling('seher',['bu'],['gözəldir']), 'şəhər');
  const trace: string[]=[];
  const result=correctText('bu seher gozeldir',false,{trace:event=>trace.push(event.reason)});
  assert.equal(result.text,'Bu şəhər gözəldir.');
  assert.ok(trace.some(reason=>reason.includes('WordLM')));
  assert.notEqual(correctText('bu seher gozeldir',false,{useWordLM:false}).text,result.text);
});

test('explicit spellings, names, identifiers and existing valid words cannot be selected', () => {
  for (const word of ['səhər','şəhər','Seher','SEHER','camelCase','bu','su','API','foo_bar'])
    assert.equal(chooseWordLMSpelling(word,['bu'],['gözəldir']),undefined);
});

test('unknown names and suffix backoff are not lexical evidence for a replacement', () => {
  assert.equal(chooseWordLMSpelling('seher',['Kamran'],['meşəni','qoruyur']),undefined);
  assert.equal(correctText('Kamran seher meşəni qoruyur.').text,'Kamran səhər meşəni qoruyur.');
});

for (const input of ['səhər yaxşıdır', 'şəhər gözəldir', 'həyət genişdir', 'heyət gəldi',
  'men bu gun mektebe getdim', 'Sənan Bakıya gedir', 'İŞIQ yanır',
  'API request backend sistemde saxlanilir', '`seher` sözü',
  'https://example.az/seher?q=seher', 'test@example.az', '<b title="seher">səhər</b>',
  '“şəhər” sözü Azərbaycan dilindədir', 'kod_1 və camelCase',
  'bu `kod` seher gozeldir']) {
  test('WordLM ablation preserves established decisions/literals: '+input, () => {
    assert.equal(correctText(input).text,correctText(input,false,{useWordLM:false}).text);
  });
}

test('WordLM does not borrow right context from a following sentence', () => {
  const first = correctText('bu seher.').text;
  assert.equal(correctText('bu seher. gozeldir').text, first+' Gözəldir.');
});
