import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { checksum } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { createExperimentPredictor, type ExperimentBundle } from './nlp/inference';
import { qualityReport } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const data = option('data'), models = option('models'), destination = option('output');
if (!data || !models || !destination) throw new Error('Use --data=split-directory --models=experiment-directory --output=selected-bundle.json');
verifyManifest(data);
const floor = Number(option('threshold-floor') ?? 0.9999);
if (!Number.isFinite(floor) || floor < 0.99 || floor > 1) throw new Error('Deployment threshold floor must be 0.99..1.');
interface Row { id: string; input: string; target: string; category: string; protectedTerms?: string[] }
const contents = readFileSync(resolve(data, 'validation.jsonl'), 'utf8');
const rows = contents.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line) as Row);
const results: { model: string; summary: ReturnType<typeof qualityReport>['overall']; eligible: boolean }[] = [];
let selected: { file: string; bundle: ExperimentBundle; score: number } | undefined;
for (const file of readdirSync(models).filter(name => /^bounded-(?:edits|uniform|no-context)-\d+\.json$/u.test(name)).sort()) {
  const bundle = JSON.parse(readFileSync(resolve(models, file), 'utf8')) as ExperimentBundle;
  if (bundle.artifact.lexiconSha256 !== checksum(JSON.stringify(bundle.lexicon))) throw new Error('Model/lexicon fingerprint mismatch.');
  bundle.artifact.threshold = Math.max(bundle.artifact.threshold, floor);
  const predict = createExperimentPredictor(bundle);
  const scored = rows.map(row => ({ ...row, actual: predict(row.input, row.protectedTerms) }));
  const summary = qualityReport(scored).overall;
  const eligible = summary.falsePositiveEdits === 0 && summary.identityChanged === 0 && summary.truePositiveEdits >= 30;
  results.push({ model: file, summary, eligible });
  if (eligible && (!selected || summary.truePositiveEdits > selected.score)) selected = { file, bundle, score: summary.truePositiveEdits };
}
if (!results.length) throw new Error('No candidate model bundles found.');
mkdirSync(dirname(resolve(destination)), { recursive: true });
if (selected) atomicWriteSync(destination, JSON.stringify(selected.bundle) + '\n');
const report = { policy: 'Validation-only selection; zero token false-positive edits/identity changes, at least 30 true-positive edits, fixed conservative score floor. This is not a real-world correctness guarantee.',
  validationSHA256: checksum(contents), thresholdFloor: floor, selected: selected?.file ?? null, results,
  nextGate: 'Complete editor validation, held-out test, identity/protected-span checks and measured latency are mandatory before importing a selected bundle into production.' };
atomicWriteSync(destination + '.selection.json', JSON.stringify(report, null, 2) + '\n');
console.log({ selected: report.selected, candidates: results.map(row => ({ model: row.model, truePositive: row.summary.truePositiveEdits, falsePositive: row.summary.falsePositiveEdits, eligible: row.eligible })) });
