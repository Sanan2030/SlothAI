import { mkdirSync, writeFileSync } from 'node:fs';
import { evaluate, policies } from './run';
import { bootstrap, metrics, type EvaluationRow } from './metrics';
const outputDirectory = process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? 'docs/evaluation/phase0';
const reference = evaluate('holdout-500');
const result: Record<string, unknown> = {};
for (const [name, runtime] of Object.entries(policies)) {
  console.error(`ablation: ${name}`);
  const rows = name === 'default' ? reference : evaluate('holdout-500', runtime);
  const changed = rows.filter((row, at) => row.output !== reference[at].output);
  const differenceRows: EvaluationRow[] = rows.map((row, at) => ({ ...row, input: reference[at].output, expected: reference[at].output }));
  const groups = new Map<string, number[]>();
  rows.forEach((row, at) => { const group = groups.get(row.documentId) ?? []; group.push(Number(row.output === row.expected) - Number(reference[at].output === reference[at].expected)); groups.set(row.documentId, group); });
  const deltas = [...groups.values()].map(group => group.reduce((sum, value) => sum + value, 0) / group.length);
  result[name] = { pairedExactDelta: bootstrap(deltas, values => values.reduce((sum, value) => sum + value, 0) / values.length), quality: metrics(rows), agreementWithDefault: metrics(differenceRows).estimates.sentenceExact, changedIds: changed.map(row => row.id), improvedIds: changed.filter(row => row.output === row.expected).map(row => row.id), degradedIds: changed.filter(row => reference.find(base => base.id === row.id)!.output === row.expected).map(row => row.id) };
}
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(`${outputDirectory}/ablation.json`, JSON.stringify({ policies: result, caveat: 'Existing runtime flags only. noBounded covers bounded/domain composition; flags do not independently disable document/log/lexical/agreement heads. No unsupported per-head causal claim is made. Flags may have no effect on the conditional default path. Institutional is experimental and absent from runtime.' }, null, 2) + '\n');
