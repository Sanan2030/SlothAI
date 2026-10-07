import { readFileSync } from 'node:fs';
import artifact from '../data/experiments/institutional/model.json';
import { createInstitutionalHead, type InstitutionalModel } from '../lib/editor/neural/institutional-head';
import { correctText } from '../lib/editor/correct';
import { qualityReport, newFalseEditRows } from './nlp/metrics';
import { readInstitutionSentences, institutionPairs, digest, INSTITUTION_CORPUS } from './institutional-data';
import { atomicWriteSync } from './atomic-files.mjs';

const model = artifact as InstitutionalModel;
if (digest(readFileSync(INSTITUTION_CORPUS, 'utf8')) !== model.corpusSHA256) throw new Error('Institutional corpus and artifact hashes disagree.');
const head = createInstitutionalHead(model), pairs = institutionPairs(readInstitutionSentences());
// Keep aggregate metrics and reproducible IDs without repeating every noisy
// input/target/output three times in the committed report. --details can
// produce the full failure list in a temporary diagnostic file.
const summarize = (result: ReturnType<typeof qualityReport>) => ({ ...result,
  failedIds: result.failures.map(row => row.id), failureCount: result.failures.length,
  failures: process.argv.includes('--details') ? result.failures : result.failures.slice(0, 12) });
const reports = ['train', 'validation', 'test'].map(split => {
  const selected = pairs.filter(row => row.split === split);
  const baseline = selected.map(row => ({ ...row, category: row.id.split(':').at(-1)!, actual: correctText(row.input).text }));
  const candidate = selected.map(row => ({ ...row, category: row.id.split(':').at(-1)!, actual: correctText(head(row.input)).text }));
  const headOnly = selected.map(row => ({ ...row, category: row.id.split(':').at(-1)!, actual: head(row.input) }));
  const regressions = candidate.filter((row, at) => baseline[at].actual === row.target && row.actual !== row.target).map(row => row.id);
  const newFalsePositives = newFalseEditRows(baseline, candidate);
  const gains = candidate.filter((row, at) => baseline[at].actual !== row.target && row.actual === row.target).map(row => row.id);
  return { split, baseline: summarize(qualityReport(baseline)), candidate: summarize(qualityReport(candidate)), headOnly: summarize(qualityReport(headOnly)),
    gains, regressions, newFalsePositives, identityChanges: headOnly.filter(row => row.input === row.target && row.actual !== row.input).map(row => row.id) };
});
const validation = reports.find(row => row.split === 'validation')!, test = reports.find(row => row.split === 'test')!;
const report = { sourceSHA256: model.corpusSHA256, artifactBytes: Buffer.byteLength(JSON.stringify(model) + '\n'),
  deployment: 'experimental artifact only; no runtime import or browser payload increase',
  provenance: '120 assistant-authored synthetic scenarios, not human-reviewed; train/validation/test scenario ownership fixed before augmentation',
  candidateReleaseEligible: validation.gains.length > 0 && test.gains.length > 0 && [validation, test].every(row => !row.regressions.length && !row.newFalsePositives.length && !row.identityChanges.length), reports };
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? 'data/nlp/institutions/evaluation-report.json';
atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, reports: reports.map(row => ({ split: row.split,
  rows: row.baseline.overall.rows, baselineExact: row.baseline.overall.exact, candidateExact: row.candidate.overall.exact,
  gains: row.gains.length, regressions: row.regressions.length, newFalsePositives: row.newFalsePositives.length,
  headCorrectEdits: row.headOnly.overall.truePositiveEdits, headWrongEdits: row.headOnly.overall.falsePositiveEdits })) }, null, 2));
if (process.argv.includes('--enforce') && [validation, test].some(row => row.regressions.length || row.newFalsePositives.length || row.identityChanges.length)) process.exitCode = 1;
