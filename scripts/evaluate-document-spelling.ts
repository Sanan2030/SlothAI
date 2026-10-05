import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { documentSpelling } from '../lib/editor/neural/document-runtime';
import { tokenize } from '../lib/editor/local-ai/core';
import { quality } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';

const raw = readFileSync('data/nlp/documents/document-unseen-test.json', 'utf8');
const hash = createHash('sha256').update(raw).digest('hex');
if (hash !== readFileSync('data/nlp/documents/document-unseen-test.json.sha256', 'utf8').trim()) throw new Error('Frozen evaluation hash changed.');
const data = JSON.parse(raw) as { cases: { id: string; input: string; target: string; errors: string }[] };
const rows = data.cases.map(row => {
  const actual = correctText(row.input).text;
  return { ...row, category: row.errors, actual, rankerOnly: documentSpelling(row.input), idempotent: correctText(actual).text === actual };
});
const lexical = (value: string) => tokenize(value).map(token => token.word.toLocaleLowerCase('az-AZ')).join(' ');
const result = { testSHA256: hash, rows: rows.length, fullOutput: quality(rows),
  lexical: quality(rows.map(row => ({ id: row.id, category: row.category, input: lexical(row.input), target: lexical(row.target), actual: lexical(row.actual) }))),
  idempotencyFailures: rows.filter(row => !row.idempotent).length,
  caveat: 'Separate assistant-authored synthetic evaluation; no real/human-reviewed or document-independent general-language certification.', cases: rows };
atomicWriteSync('data/nlp/documents/document-evaluation-report.json', JSON.stringify(result, null, 2) + '\n');
console.log({ fullOutput: result.fullOutput, lexical: result.lexical, idempotencyFailures: result.idempotencyFailures });
