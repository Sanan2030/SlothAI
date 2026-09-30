import { readFileSync } from 'node:fs';
import corpus from '../data/local-ai/context-corpus.json';
import { fold, tokenize } from '../lib/editor/local-ai/core';

const normalize = (value: string) => tokenize(fold(value)).map(token => token.word).join(' ');

/** Fail closed on duplicate texts/IDs, missing labels or evaluation leakage. */
export function contextTrainingTexts(): string[] {
  const ids = new Set<string>(), texts = new Set<string>();
  for (const row of corpus.rows) {
    const key = normalize(row.text);
    if (ids.has(row.id) || texts.has(key) || !['train', 'validation', 'test'].includes(row.split)
      || !tokenize(row.text).some(token => token.word.toLocaleLowerCase('az-AZ') === row.word)) {
      throw new Error(`Invalid context training row: ${row.id}`);
    }
    ids.add(row.id); texts.add(key);
  }
  const forbidden = new Set<string>();
  const seeds = readFileSync('data/local-ai/seeds.txt', 'utf8').trim().split('\n');
  seeds.forEach((text, index) => {
    if (index % 5 === 4 || index >= 100 && index % 5 === 3) forbidden.add(normalize(text));
  });
  for (const path of ['tests/fixtures/independent-gold-v2.json', 'tests/fixtures/additional-gold-200.json']) {
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as { cases: { expected: string }[] };
    fixture.cases.forEach(row => forbidden.add(normalize(row.expected)));
  }
  const fresh = JSON.parse(readFileSync('data/local-ai/fresh-holdout.json', 'utf8')) as { pairs: { target: string }[] };
  fresh.pairs.forEach(row => forbidden.add(normalize(row.target)));
  corpus.rows.filter(row => row.split !== 'train').forEach(row => forbidden.add(normalize(row.text)));
  const expansion = JSON.parse(readFileSync('data/local-ai/expansion.json', 'utf8')) as {
    forms: { texts: string[] }[]; boundaries: { texts: string[] }[];
  };
  const existingTraining = [...seeds.filter((_, index) => index % 5 !== 4 && !(index >= 100 && index % 5 === 3)),
    ...readFileSync('data/local-ai/supplemental-training.txt', 'utf8').trim().split('\n'),
    ...[...expansion.forms, ...expansion.boundaries].flatMap(row => row.texts)];
  const reserved = new Set(corpus.rows.filter(row => row.split !== 'train').map(row => normalize(row.text)));
  for (const text of existingTraining) if (reserved.has(normalize(text))) throw new Error(`Context holdout leakage: ${text}`);
  const training = corpus.rows.filter(row => row.split === 'train').map(row => row.text);
  for (const text of training) if (forbidden.has(normalize(text))) throw new Error(`Evaluation leakage: ${text}`);
  return training;
}
