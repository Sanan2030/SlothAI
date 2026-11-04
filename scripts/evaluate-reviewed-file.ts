/** Re-run user-reviewed cases through the current engine; never replay stored expected outputs. */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseReviewCorpus, MAX_REVIEW_FILE_BYTES } from '../lib/editor/review-corpus';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
const filename = process.argv[2];
if (!filename) throw new Error('İstifadə: npm run review:test -- /fayl/slothai-reviewed-tests.json');
const path = resolve(filename);
if (statSync(path).size > MAX_REVIEW_FILE_BYTES) throw new Error('Test faylı 25 MB həddini keçir.');
const corpus = parseReviewCorpus(readFileSync(path, 'utf8'));
if (!corpus.cases.length) throw new Error('Faylda test nümunəsi yoxdur.');
async function main() {
  const rows = [];
  for (const row of corpus.cases) {
    const result = await getStrategyRegistry().get(row.module === 'mail' ? 'gmail-corrector' : 'text-corrector').transform({
      text: row.input, options: { ...(row.module === 'mail' ? { emailGreeting: row.greeting, omitSubject: true }
        : { preserveFormatting: row.preserveFormatting }), ...(row.usePunctCase ? { usePunctCase: true } : {}) },
    });
    const output = result.transformedText;
    rows.push({ ...row, recordedActual: row.actual, actual: output, exact: output === row.expected });
  }
  const report = { source: path, total: rows.length, exact: rows.filter(row => row.exact).length,
    remaining: rows.filter(row => !row.exact).length, rows };
  const reportPath = path + '.results.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, exact: report.exact, remaining: report.remaining, report: reportPath }, null, 2));
  if (report.remaining) process.exitCode = 1;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
