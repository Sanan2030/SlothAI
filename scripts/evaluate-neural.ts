import corpus from '../data/neural/corpus.json';
import challenge from '../data/neural/challenge.json';
import previous from '../data/local-ai/paired-test-report.json';
import model from '../lib/editor/neural/model.json';
import { correctText } from '../lib/editor/correct';
import { neuralAgreement, neuralSpelling } from '../lib/editor/neural/runtime';
import { agreementFeatures, type Subject } from '../lib/editor/neural/features';
import type { MorphologicalFeatures } from '../lib/editor/contracts/morphology';
import { predictNetwork } from '../lib/editor/neural/network';
import { atomicWriteSync } from './atomic-files.mjs';
const lexical = corpus.lexical.filter(row => row.split === 'test').map(row => ({ id: row.id,
  exact: neuralSpelling(row.input) === row.target, actual: neuralSpelling(row.input), expected: row.target }));
const agreement = corpus.agreement.filter(row => row.split === 'test').map(row => ({ id: row.id,
  predictedCompatible: predictNetwork(model.agreement, agreementFeatures(row.subject as Subject, row.verb as MorphologicalFeatures)) >= model.agreementThreshold,
  compatible: row.compatible, actual: neuralAgreement(row.input), expected: row.target }));
const probes = challenge.rows.map(row => ({ ...row, actual: correctText(row.input).text, exact: correctText(row.input).text === row.expected }));
const regressions = previous.rows.filter(row => row.mode === 'text' && row.exact).filter(row => correctText(row.input, row.id === 'challenge-031' || row.id === 'challenge-032').text !== row.actual).map(row => row.id);
const summary = { lexical: { total: lexical.length, exact: lexical.filter(row => row.exact).length },
  agreement: { total: agreement.length, correctClassification: agreement.filter(row => row.predictedCompatible === row.compatible).length,
    exact: agreement.filter(row => row.actual === row.expected).length },
  challenge: { total: probes.length, exact: probes.filter(row => row.exact).length }, previousExactTextRegressions: regressions };
atomicWriteSync('data/neural/evaluation-report.json', JSON.stringify({ ...summary, caveat: 'Correlated synthetic exercises and small authored development probes, not real-world accuracy', probes,
  lexicalFailures: lexical.filter(row => !row.exact), agreementFailures: agreement.filter(row => row.actual !== row.expected) }, null, 2) + '\n');
console.log(summary);
if (process.argv.includes('--enforce') && (regressions.length || summary.lexical.exact !== lexical.length || summary.challenge.exact !== probes.length || summary.agreement.correctClassification !== agreement.length || summary.agreement.exact !== agreement.length)) process.exitCode = 1;
