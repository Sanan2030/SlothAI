import { readFileSync } from 'node:fs';
import pairs from '../data/neural/attention-pairs.json';
import independent from '../data/neural/attention-independent.json';
import artifactJSON from '../lib/editor/neural/attention-model.json';
import baseJSON from '../lib/editor/neural/model.json';
import type { PairedModel } from '../lib/editor/local-ai/paired';
import { attentionLexicon, transpositionIndex, rankAttention, tokenPosition, type AttentionArtifact } from '../lib/editor/neural/attention';
import { correctText } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { atomicWriteSync } from './atomic-files.mjs';
const artifact = artifactJSON as AttentionArtifact;
const lexicon = attentionLexicon(baseJSON.lexicon as PairedModel, artifact.vocabulary), index = transpositionIndex(lexicon);
const independentRun = process.argv.includes('--independent');
const rows = (independentRun ? independent.rows : pairs.rows.filter(row => row.split === 'test')).map(row => {
  const { tokens, at } = tokenPosition(row.input, row.raw);
  return { ...row, actual: correctText(row.input).text, neuralActual: neuralSpelling(row.input),
    decision: rankAttention(artifact, lexicon, index, row.raw, tokens, at) ?? null };
});
const baseline = JSON.parse(readFileSync(independentRun ? 'data/neural/attention-independent-baseline.json' : 'data/neural/attention-baseline.json', 'utf8')) as { rows: typeof rows; exact: number; neuralExact: number };
const regressions = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual === old.target) && row.actual !== row.target);
const neuralRegressions = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.neuralActual === old.target) && row.neuralActual !== row.target);
const gains = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual !== old.target) && row.actual === row.target);
const accepted = rows.filter(row => row.decision?.accepted), wrong = accepted.filter(row => row.decision?.candidate !== row.expectedWord);
const summary = { total: rows.length, exact: rows.filter(row => row.actual === row.target).length,
  neuralExact: rows.filter(row => row.neuralActual === row.target).length, baselineExact: baseline.exact, baselineNeuralExact: baseline.neuralExact ?? null,
  acceptedHeadCorrections: accepted.length, wrongHeadCorrections: wrong.length,
  remainingFailures: rows.filter(row => row.actual !== row.target).map(row => row.id),
  gained: gains.map(row => row.id), regressions: regressions.map(row => row.id), neuralRegressions: neuralRegressions.map(row => row.id) };
atomicWriteSync(independentRun ? 'data/neural/attention-independent-evaluation.json' : 'data/neural/attention-evaluation.json', JSON.stringify({ ...summary, rows,
  caveat: 'Frozen authored heldout sentences and swap positions; shared word families. Not real-user accuracy or a semantic-understanding guarantee.' }, null, 2) + '\n');
console.log(summary);
if (process.argv.includes('--enforce') && (regressions.length || neuralRegressions.length || wrong.length || !gains.length || (!independentRun && summary.exact !== rows.length))) {
  throw new Error('Attention head must improve heldout outputs without a regression or incorrect accepted correction.');
}
