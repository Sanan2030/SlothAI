import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import attention from '../data/neural/attention-pairs.json';
import independent from '../data/neural/attention-independent.json';
import { createExperimentPredictor, type ExperimentBundle } from './nlp/inference';
import { correctText } from '../lib/editor/correct';
import { qualityReport, type QualityRow } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = option('input'), output = option('output') ?? 'data/neural/quality-report.json';
interface InputRow { id: string; input: string; target: string; category?: string; domain?: string; reviewedBy?: string; provenance?: string; protectedTerms?: string[] }
let source: InputRow[];
if (file) source = readFileSync(file, 'utf8').split(/\r?\n/u).filter(line => line.trim()).map(line => JSON.parse(line) as InputRow);
else source = [...attention.rows.filter(row => row.split === 'test'), ...independent.rows];
if (!source.length) throw new Error('Evaluation input is empty.');
const real = process.argv.includes('--real');
for (const row of source) {
  if (!row.id || typeof row.input !== 'string' || typeof row.target !== 'string') throw new Error('Each evaluation row needs id, input and target.');
  if (real && (!row.reviewedBy?.trim() || !row.provenance?.trim())) throw new Error('Real evaluation requires reviewedBy and provenance on every row.');
}
const modelFile = option('model');
const predictor = modelFile ? createExperimentPredictor(JSON.parse(readFileSync(modelFile, 'utf8')) as ExperimentBundle) : undefined;
const evaluate = (useAttention: boolean): QualityRow[] => source.map(row => ({ id: row.id, input: row.input, target: row.target,
  category: row.category ?? row.domain ?? 'unspecified', actual: predictor ? (useAttention ? predictor(row.input, row.protectedTerms) : row.input) : correctText(row.input, false, { useAttention }).text }));
const without = evaluate(false), withHead = evaluate(true);
const report = { source: real ? 'User-attested reviewed real examples' : file ? 'Provided examples; real provenance not asserted' : 'Authored development and additional contexts, shared lexical families',
  attentionOff: qualityReport(without), attentionOn: qualityReport(withHead),
  regressions: withHead.filter((row, at) => without[at].actual === row.target && row.actual !== row.target),
  gains: withHead.filter((row, at) => without[at].actual !== row.target && row.actual === row.target),
  ablation: predictor ? 'Experimental head-only inference versus unchanged input; not the production editor. Conservative proper-name/known-word protection.' : 'Same editor, same inputs, only useAttention changes. Earlier morphology/rules/other networks remain enabled.' };
mkdirSync(dirname(output), { recursive: true }); atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log({ without: report.attentionOff.overall, with: report.attentionOn.overall, regressions: report.regressions.length, gains: report.gains.length });
if (process.argv.includes('--enforce') && (report.regressions.length || report.attentionOn.overall.identityChanged || (report.attentionOn.overall.precision !== null && report.attentionOff.overall.precision !== null && report.attentionOn.overall.precision < report.attentionOff.overall.precision))) throw new Error('Attention introduced a previously correct full-output regression.');
