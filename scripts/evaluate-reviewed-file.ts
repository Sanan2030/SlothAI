/** Re-run user-reviewed cases through the current engine; never replay stored expected outputs. */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseReviewCorpus, MAX_REVIEW_FILE_BYTES } from '../lib/editor/review-corpus';
import { correctText, formatEmail } from '../lib/editor/correct';
const filename = process.argv[2];
if (!filename) throw new Error('İstifadə: npm run review:test -- /fayl/slothai-reviewed-tests.json');
const path = resolve(filename);
if (statSync(path).size > MAX_REVIEW_FILE_BYTES) throw new Error('Test faylı 25 MB həddini keçir.');
const corpus = parseReviewCorpus(readFileSync(path, 'utf8'));
if (!corpus.cases.length) throw new Error('Faylda test nümunəsi yoxdur.');
const rows = corpus.cases.map(row => {
  const output = row.module === 'mail' ? formatEmail(row.input, { emailGreeting: row.greeting, omitSubject: true }).text
    : correctText(row.input, row.preserveFormatting).text;
  return { ...row, recordedActual: row.actual, actual: output, exact: output === row.expected };
});
const report = { source: path, total: rows.length, exact: rows.filter(row => row.exact).length,
  remaining: rows.filter(row => !row.exact).length, rows };
const reportPath = path + '.results.json';
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, exact: report.exact, remaining: report.remaining, report: reportPath }, null, 2));
if (report.remaining) process.exitCode = 1;
