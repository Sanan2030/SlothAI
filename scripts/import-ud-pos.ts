import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { atomicWriteSync } from './atomic-files.mjs';
import { trainPOS, tagPOS, type POSToken } from '../lib/editor/local-ai/pos';
const path = 'data/local-ai/ud/az_tuecl-ud-test.conllu';
const source = readFileSync(path, 'utf8');
const texts = new Map<string, string>();
const sentences = source.trim().split(/\n\s*\n/u).map(block => {
  const id = block.match(/^# parallel_id = (.+)$/mu)?.[1] ?? block.match(/^# sent_id = (.+)$/mu)![1];
  const family = id.split('/').slice(0, 2).join('/');
  const tokens: POSToken[] = block.split('\n').filter(line => /^\d+\t/u.test(line)).map(line => {
    const fields = line.split('\t'); return { word: fields[1], lemma: fields[2], pos: fields[3] };
  });
  const normalized = tokens.map(token => token.word.toLocaleLowerCase('az-AZ')).join(' ');
  const group = texts.get(normalized) ?? family; texts.set(normalized, group);
  return { id, group, tokens };
});
// Union duplicate-sentence families before assigning splits.
const parent = new Map<string, string>();
const root = (key: string): string => { let value = key; while (parent.has(value)) value = parent.get(value)!; return value; };
for (const row of sentences) {
  const family = row.id.split('/').slice(0, 2).join('/');
  if (root(family) !== root(row.group)) parent.set(root(family), root(row.group));
}
const split = (group: string) => {
  const value = parseInt(createHash('sha256').update(root(group)).digest('hex').slice(0, 8), 16) % 10;
  return value < 2 ? 'test' : value === 2 ? 'validation' : 'train';
};
const rows = sentences.map(row => ({ ...row, split: split(row.group) }));
const model = trainPOS(rows.filter(row => row.split === 'train').map(row => row.tokens));
const evaluations = ['validation', 'test'].map(part => {
  let correct = 0, total = 0, unknown = 0, unknownCorrect = 0;
  const confusion: Record<string, number> = {};
  for (const row of rows.filter(row => row.split === part)) {
    const output = tagPOS(model, row.tokens.map(token => token.word));
    row.tokens.forEach((token, at) => {
      total++; correct += Number(token.pos === output[at].tag);
      if (!model.words[token.word.toLocaleLowerCase('az-AZ')]) { unknown++; unknownCorrect += Number(token.pos === output[at].tag); }
      if (token.pos !== output[at].tag) { const key = token.pos + '>' + output[at].tag; confusion[key] = (confusion[key] ?? 0) + 1; }
    });
  }
  return { split: part, total, correct, accuracy: total ? correct / total : null, unknown, unknownCorrect, confusion };
});
atomicWriteSync('lib/editor/local-ai/pos-model.json', JSON.stringify(model, null, 2) + '\n');
atomicWriteSync('data/local-ai/ud/splits.json', JSON.stringify(rows.map(row => ({ id: row.id, group: root(row.group), split: row.split })), null, 2) + '\n');
atomicWriteSync('data/local-ai/pos-report.json', JSON.stringify({ sourceRevision: '69fc3c609ccad52adf644fe350cf427713f42b79', sourceSha256: createHash('sha256').update(source).digest('hex'), license: model.license, sentences: rows.length, train: rows.filter(row => row.split === 'train').length, evaluations, limitations: 'Small grammar-example treebank with variety differences; not general Azerbaijani POS accuracy.' }, null, 2) + '\n');
console.log(JSON.stringify(evaluations));
