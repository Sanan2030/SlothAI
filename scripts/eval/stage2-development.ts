/** Development-only assistant-authored references; no phase0 or training data. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { metrics, type EvaluationRow } from './metrics';
const option = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

async function main() {
  const path = 'docs/stage2/development.json', bytes = readFileSync(path);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== readFileSync('docs/stage2/development.sha256', 'utf8').split(/\s/u)[0]) throw new Error('Development targets changed');
  const data = JSON.parse(bytes.toString('utf8')) as { trainingAllowed: boolean; provenance: string;
    cases: { id: string; category: string; input: string; expected: string }[] };
  if (data.trainingAllowed || data.cases.length < 300) throw new Error('Invalid development corpus');
  const { correctText } = await import(pathToFileURL(resolve(option('editor', 'lib/editor/correct.ts'))).href) as typeof import('../../lib/editor/correct');
  const rows: EvaluationRow[] = data.cases.map(row => {
    const output = correctText(row.input).text;
    return { ...row, documentId: row.id, domain: 'assistant-authored-development', output, idempotent: correctText(output).text === output };
  });
  const report = { provenance: data.provenance, developmentSHA256: hash, metrics: metrics(rows),
    failures: rows.filter(row => row.output !== row.expected) };
  writeFileSync(option('out', '/tmp/sloth-stage2-development.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report.metrics.counts, failedRows: report.failures.length }, null, 2));
  if (process.argv.includes('--enforce') && (report.failures.length || report.metrics.counts.unstable)) process.exitCode = 1;
}
void main();
