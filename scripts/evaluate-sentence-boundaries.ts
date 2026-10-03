import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { correctText } from '../lib/editor/correct';
import type { NeuralBoundaryArtifact } from '../lib/editor/neural/boundary-features';
import { loadBoundaryDocuments, type BoundaryDocument } from './nlp/sentence-boundary-data';
import { checksum, random, type Split } from './nlp/data';
import { qualityReport, newFalseEditRows } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option('source'), output = option('output'), input = option('input'), split = option('split') ?? 'validation';
if (!source || !output || !['train', 'validation', 'test'].includes(split)) throw new Error('Use --source=frozen-splits --output=report.json [--split=validation|test]');
const documents: BoundaryDocument[] = input ? readFileSync(input, 'utf8').split(/\r?\n/u).filter(Boolean).map(line => ({ ...JSON.parse(line), split: 'test' as Split }))
  : loadBoundaryDocuments(source, 'data/nlp/reviews/az-batch-001-splits').filter(doc => doc.split === split);
const modelFile = option('model'), model = modelFile ? JSON.parse(readFileSync(modelFile, 'utf8')) as NeuralBoundaryArtifact : undefined;
const cases = documents.filter(doc => !/[`<>|]/u.test(doc.text) && !/^\s*#/mu.test(doc.text)).flatMap(doc => {
  const rng = random('boundary-evaluation-mask-v1:' + doc.documentId);
  return [
    { id: doc.documentId + ':unpunctuated', input: doc.text.replace(/[.!?,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim(), target: doc.text, category: 'unpunctuated' },
    { id: doc.documentId + ':partial', input: doc.text.replace(/[.!?]+/gu, value => rng() < 0.5 ? value : ' ').replace(/[,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim(), target: doc.text, category: 'partial' },
    { id: doc.documentId + ':identity', input: doc.text, target: doc.text, category: 'identity' },
  ];
});
const before = cases.map(row => ({ ...row, actual: correctText(row.input, true, { useNeuralBoundary: false }).text }));
const after = cases.map(row => ({ ...row, actual: correctText(row.input, true, { boundaryModel: model }).text }));
const newFalsePositiveRows = newFalseEditRows(before, after);
const regressions = after.filter((row, at) => before[at].actual === row.target && row.actual !== row.target);
const gains = after.filter((row, at) => before[at].actual !== row.target && row.actual === row.target);
const off = qualityReport(before), on = qualityReport(after);
const report = { split: input ? 'additional source documents excluded from training' : split, sourceRows: documents.length,
  inputSHA256: checksum(JSON.stringify(cases)), ablation: 'Complete editor, only the optional neural sentence-gap head changes; frozen document references and other heads unchanged.',
  before: off, after: on, newFalsePositiveRows, regressions, gains, rows: after.map((row, at) => ({ ...row, before: before[at].actual })) };
mkdirSync(dirname(resolve(output)), { recursive: true }); atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log({ rows: cases.length, beforeExact: off.overall.exact, afterExact: on.overall.exact, newWrong: newFalsePositiveRows.length, regressions: regressions.length, gains: gains.length });
if (process.argv.includes('--enforce') && (newFalsePositiveRows.length || regressions.length
  || on.overall.identityChanged > off.overall.identityChanged
  || on.overall.precision !== null && off.overall.precision !== null && on.overall.precision < off.overall.precision)) {
  throw new Error('Sentence-boundary complete-editor regression gate failed.');
}
