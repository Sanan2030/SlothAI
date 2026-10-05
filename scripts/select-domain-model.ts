import { createDomainHead } from '../lib/editor/neural/bounded-head';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { correctText } from '../lib/editor/correct';
import { createExperimentFallback, type ExperimentBundle } from './nlp/inference';
import { checksum } from './nlp/data';
import { parseDomainCorpus } from './nlp/domain-data';
import { verifyManifest } from './nlp/manifest';
import { quality, newFalseEditRows } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const data = option('data'), models = option('models'), old = option('baseline-model'), output = option('output');
if (!data || !models || !old || !output) throw new Error('Use --data=domain-splits --models=candidates --baseline-model=production.json --output=selected.json');
verifyManifest(data);
interface Row { id: string; input: string; target: string; category: string; protectedTerms?: string[] }
const raw = readFileSync(resolve(data, 'validation.jsonl'), 'utf8');
const rows: Row[] = raw.trim().split('\n').map(line => JSON.parse(line));
// Add clean validation references explicitly; never use test or training scores for selection.
for (const row of parseDomainCorpus(readFileSync('data/nlp/domain/az-domain-001.json', 'utf8')).filter(row => row.split === 'validation' && row.input !== row.target)) {
  rows.push({ ...row, id: row.id + ':identity', input: row.target, category: 'identity' });
}
const previousBundle = JSON.parse(readFileSync(old, 'utf8')) as ExperimentBundle;
const previousCache = new Map<string, ReturnType<typeof createExperimentFallback>>();
const evaluate = (bundle: ExperimentBundle, additive = true) => {
  if (bundle.artifact.lexiconSha256 !== checksum(JSON.stringify(bundle.lexicon))) throw new Error('Model checksum mismatch.');
  const cache = new Map<string, ReturnType<typeof createExperimentFallback>>();
  return rows.map(row => {
    const key = JSON.stringify(row.protectedTerms ?? []);
    if (!cache.has(key)) cache.set(key, additive ? createDomainHead(bundle, row.protectedTerms) : createExperimentFallback(bundle, row.protectedTerms));
    if (!previousCache.has(key)) previousCache.set(key, createExperimentFallback(previousBundle, row.protectedTerms));
    const fallback = cache.get(key)!;
    return { ...row, actual: correctText(row.input, false, { useBounded: false, neuralFallback: additive ? (raw, tokens, at) => previousCache.get(key)!(raw, tokens, at) ?? fallback(raw, tokens, at) : fallback }).text };
  });
};
const baseline = evaluate(previousBundle, false), baselineQuality = quality(baseline);
const candidates = readdirSync(models).filter(file => /^bounded-edits-\d+\.json$/u.test(file)).sort();
const reports: object[] = [];
let winner: { bundle: ExperimentBundle; file: string; score: number } | undefined;
const floors = option('floor') ? [Number(option('floor'))] : [0.99995, 0.95, 0.9, 0.7];
if (floors.some(value => ![0.99995, 0.95, 0.9, 0.7].includes(value))) throw new Error('Unsupported validation floor.');
for (const file of candidates) for (const floor of floors) {
  const bundle = JSON.parse(readFileSync(resolve(models, file), 'utf8')) as ExperimentBundle;
  bundle.artifact.threshold = floor;
  const after = evaluate(bundle), summary = quality(after), newWrong = newFalseEditRows(baseline, after);
  const regressions = after.filter((row, at) => baseline[at].actual === row.target && row.actual !== row.target).map(row => row.id);
  const eligible = !newWrong.length && !regressions.length && summary.identityChanged <= baselineQuality.identityChanged
    && summary.truePositiveEdits > baselineQuality.truePositiveEdits;
  reports.push({ file, floor, threshold: bundle.artifact.threshold, eligible, summary, newWrong, regressions });
  console.log({ file, floor, eligible, exact: summary.exact, newWrong: newWrong.length, regressions: regressions.length });
  if (eligible && (!winner || summary.truePositiveEdits > winner.score)) winner = { bundle, file, score: summary.truePositiveEdits };
}
mkdirSync(dirname(output), { recursive: true });
if (winner) atomicWriteSync(output, JSON.stringify(winner.bundle) + '\n');
atomicWriteSync(output + '.selection.json', JSON.stringify({ policy: 'Complete-editor validation only; previous production head first, domain head only on abstention; strict improvement; zero new wrong token edits or exact regressions; no additional identity changes; maximize correct edits. Scores are not calibrated probabilities.',
  validationSHA256: checksum(JSON.stringify(rows)), baseline: baselineQuality, selected: winner?.file ?? null, reports }, null, 2) + '\n');
if (!winner) throw new Error('No domain model passed the frozen validation gates.');
