import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import attention from '../data/neural/attention-pairs.json';
import independent from '../data/neural/attention-independent.json';
import { createExperimentPredictor, createExperimentFallback, type ExperimentBundle } from './nlp/inference';
import { correctText } from '../lib/editor/correct';
import { qualityReport, type QualityRow } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = option('input'), output = option('output') ?? 'data/neural/quality-report.json';
interface InputRow { id: string; input: string; target: string; category?: string; domain?: string; reviewedBy?: string; provenance?: string; annotationStatus?: string; protectedTerms?: string[] }
let source: InputRow[];
if (file) source = readFileSync(file, 'utf8').split(/\r?\n/u).filter(line => line.trim()).map(line => JSON.parse(line) as InputRow);
else source = [...attention.rows.filter(row => row.split === 'test'), ...independent.rows];
if (!source.length) throw new Error('Evaluation input is empty.');
const real = process.argv.includes('--real');
for (const row of source) {
  if (!row.id || typeof row.input !== 'string' || typeof row.target !== 'string') throw new Error('Each evaluation row needs id, input and target.');
  if (real && (row.annotationStatus === 'assistant-reference' || !row.reviewedBy?.trim() || !row.provenance?.trim())) throw new Error('Real evaluation requires human review and provenance; assistant references cannot be labeled human-reviewed.');
}
const modelFile = option('model');
const fullEditor = process.argv.includes('--full-editor');
if (fullEditor && !modelFile) throw new Error('full-editor requires a model bundle.');
const bundle = modelFile ? JSON.parse(readFileSync(modelFile, 'utf8')) as ExperimentBundle : undefined;
const floor = Number(option('threshold-floor') ?? 0);
if (!Number.isFinite(floor) || floor < 0 || floor > 1) throw new Error('threshold-floor must be 0..1.');
if (bundle) bundle.artifact.threshold = Math.max(bundle.artifact.threshold, floor);
const predictor = bundle ? createExperimentPredictor(bundle) : undefined;
const evaluate = (useAttention: boolean): QualityRow[] => source.map(row => ({ id: row.id, input: row.input, target: row.target,
  category: row.category ?? row.domain ?? 'unspecified', actual: fullEditor && bundle ? correctText(row.input, false, { neuralFallback: useAttention ? createExperimentFallback(bundle, row.protectedTerms) : undefined }).text : predictor ? (useAttention ? predictor(row.input, row.protectedTerms) : row.input) : correctText(row.input, false, { useAttention }).text }));
const without = evaluate(false), withHead = evaluate(true);
const newFalsePositiveRows = withHead.filter((row, at) => qualityReport([row]).overall.falsePositiveEdits > qualityReport([without[at]]).overall.falsePositiveEdits).map(row => row.id);
const report = { newFalsePositiveRows, source: real ? 'User-attested reviewed real examples' : file ? 'Provided examples; real provenance not asserted' : 'Authored development and additional contexts, shared lexical families',
  attentionOff: qualityReport(without), attentionOn: qualityReport(withHead),
  regressions: withHead.filter((row, at) => without[at].actual === row.target && row.actual !== row.target),
  gains: withHead.filter((row, at) => without[at].actual !== row.target && row.actual === row.target),
  ablation: fullEditor ? 'Complete editor, only optional candidate fallback changes. Existing morphology, attention, rules and formatting stay enabled.' : predictor ? 'Experimental head-only inference versus unchanged input; not the production editor. Conservative proper-name/known-word protection.' : 'Same editor, same inputs, only useAttention changes. Earlier morphology/rules/other networks remain enabled.' };
mkdirSync(dirname(output), { recursive: true }); atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log({ without: report.attentionOff.overall, with: report.attentionOn.overall, regressions: report.regressions.length, gains: report.gains.length });
if (process.argv.includes('--enforce') && (report.regressions.length || (fullEditor ? newFalsePositiveRows.length || report.attentionOn.overall.identityChanged > report.attentionOff.overall.identityChanged : report.attentionOn.overall.identityChanged) || (report.attentionOn.overall.precision !== null && report.attentionOff.overall.precision !== null && report.attentionOn.overall.precision < report.attentionOff.overall.precision))) throw new Error('Attention introduced a previously correct full-output regression.');
