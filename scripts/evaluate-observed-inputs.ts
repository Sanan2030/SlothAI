import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { qualityReport, type QualityRow } from './nlp/metrics';
const option = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
async function main() {
const engine = await import(pathToFileURL(resolve(option('engine', 'lib/editor/correct.ts'))).href) as typeof import('../lib/editor/correct');
const data = JSON.parse(readFileSync('data/nlp/real/development-evaluation.json', 'utf8'));
const training = JSON.parse(readFileSync('data/nlp/real/observed-spelling.json', 'utf8'));
const trainDocuments = new Set(training.cases.map((row: { documentId: string }) => row.documentId));
const rows: QualityRow[] = [];
for (const row of data.cases) {
  if (trainDocuments.has(row.documentId)) throw new Error('Document leakage between observed train and evaluation.');
  const run = (input: string) => row.module === 'mail' ? engine.formatEmail(input, { emailGreeting: row.greeting, omitSubject: true }).text : engine.correctText(input).text;
  rows.push({ id: row.id, input: row.input, target: row.target, actual: run(row.input), category: row.category });
  rows.push({ id: row.id + '-identity', input: row.target, target: row.target, actual: run(row.target), category: 'identity' });
}
const report = { certification: data.certification, trainingDocuments: trainDocuments.size, evaluationDocuments: new Set(data.cases.map((row: { documentId: string }) => row.documentId)).size, ...qualityReport(rows), rows };
const output = option('output', '/tmp/slothai-real-evaluation.json');
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.overall, output }));
if (process.argv.includes('--enforce') && (report.overall.identityChanged || report.overall.exact < rows.length)) process.exitCode = 1;

}
main().catch(error => { console.error(error); process.exitCode = 1; });
