/** Existing fixtures are diagnostic text-mode snapshots; use gold:exact for mode-aware gold gates. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { correctText } from '../../lib/editor/correct';
import { metrics, type EvaluationRow } from './metrics';
interface Row { id?: string; input?: string; expected?: string; category?: string; preserveFormatting?: boolean }
const fixtures = readdirSync('tests/fixtures').filter(name => name.endsWith('.json')).sort().map(name => {
  const data = JSON.parse(readFileSync(`tests/fixtures/${name}`, 'utf8'));
  return { name, rows: (Array.isArray(data) ? data : data.cases ?? data.rows ?? (data.input ? [data] : [])) as Row[] };
});
const inputs = new Map<string, string>();
for (const fixture of fixtures) for (const row of fixture.rows) if (row.id && row.input) inputs.set(row.id, row.input);
const snapshot: { fixture: string; id: string; input: string; expected?: string; output: string; idempotent: boolean }[] = [];
for (const fixture of fixtures) {
  let counter = 0;
  for (const row of fixture.rows) {
    const input = row.input ?? (row.id ? inputs.get(row.id) : undefined); if (!input) continue;
    const output = correctText(input, row.preserveFormatting ?? false).text;
    snapshot.push({ fixture: fixture.name, id: row.id ?? String(++counter), input, expected: row.expected, output, idempotent: correctText(output, row.preserveFormatting ?? false).text === output });
  }
}
const selected = ['release-holdout-300.json', 'diverse-holdout-300.json'];
const quality = Object.fromEntries(selected.filter(name => fixtures.some(fixture => fixture.name === name)).map(name => {
  const rows: EvaluationRow[] = snapshot.filter(row => row.fixture === name && row.expected !== undefined).map(row => ({ ...row, documentId: row.id, domain: name, category: 'mixed', expected: row.expected! }));
  return [name, metrics(rows)];
}));
const compare = process.argv.find(arg => arg.startsWith('--compare='))?.slice(10);
let changed = 0, compared = 0;
if (compare) {
  const previous = JSON.parse(readFileSync(compare, 'utf8')) as typeof snapshot;
  const byKey = new Map(previous.map(row => [`${row.fixture}/${row.id}`, row.output]));
  for (const row of snapshot) if (byKey.has(`${row.fixture}/${row.id}`)) { compared++; changed += Number(row.output !== byKey.get(`${row.fixture}/${row.id}`)); }
}
const bytes = JSON.stringify(snapshot, null, 2) + '\n';
// Large raw snapshot stays local unless --snapshot-out is explicitly supplied.
const out = process.argv.find(arg => arg.startsWith('--snapshot-out='))?.slice(15); if (out) writeFileSync(out, bytes);
const reportDirectory = process.argv.find(arg=>arg.startsWith('--out='))?.slice(6) ?? 'docs/evaluation/phase0';
mkdirSync(reportDirectory,{recursive:true});
writeFileSync(`${reportDirectory}/fixtures.json`, JSON.stringify({ rows: snapshot.length, sha256: createHash('sha256').update(bytes).digest('hex'), compared, changed, idempotencyFailures: snapshot.filter(row => !row.idempotent).map(row => `${row.fixture}/${row.id}`), selectedQuality: quality, provenance: 'Existing project fixtures, text-mode diagnostic only; no frozen targets changed. Gold tests use their dedicated mode-aware evaluator.' }, null, 2) + '\n');
if (compare && changed) throw new Error(`Production output changed in ${changed} fixture rows`);
