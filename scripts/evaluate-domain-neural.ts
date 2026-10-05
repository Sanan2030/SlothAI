import { createDomainHead } from '../lib/editor/neural/bounded-head';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { correctText } from '../lib/editor/correct';
import { createExperimentFallback, type ExperimentBundle } from './nlp/inference';
import { parseDomainCorpus, auditDomainOverlap } from './nlp/domain-data';
import { checksum } from './nlp/data';
import { qualityReport, newFalseEditRows, type QualityRow } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const modelPath = option('model'), baselinePath = option('baseline-model'), output = option('output');
if (!modelPath || !output) throw new Error('Use --model=candidate.json --output=report.json [--baseline-model=previous.json] [--split=validation] [--fresh]');
const load = (path: string) => {
  const bundle = JSON.parse(readFileSync(path, 'utf8')) as ExperimentBundle;
  if (bundle.artifact.lexiconSha256 !== checksum(JSON.stringify(bundle.lexicon))) throw new Error('Artifact checksum mismatch.');
  return bundle;
};
const candidate = load(modelPath), baseline = load(baselinePath ?? 'lib/editor/neural/bounded-model.json');
const domain = parseDomainCorpus(readFileSync('data/nlp/domain/az-domain-001.json', 'utf8'));
interface Case { id: string; documentId: string; input: string; target: string; split?: string; domain?: string; category: string; protectedTerms?: string[] }
const fresh: Case[] = process.argv.includes('--fresh') ? readFileSync('data/nlp/domain/az-domain-001-fresh.jsonl', 'utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line)) : [];
if (fresh.length) auditDomainOverlap(fresh, domain);
const split = option('split');
if (split && !['train', 'validation', 'test'].includes(split)) throw new Error('Unknown evaluation partition.');
const external = option('input');
const examples: Case[] = external ? readFileSync(external, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : fresh.length ? fresh : domain.filter(row => !split || row.split === split);
if (!examples.length || examples.some(row => !row.id || typeof row.input !== 'string' || !row.input.trim() || typeof row.target !== 'string' || !row.target.trim())) throw new Error('Invalid evaluation rows.');
const cases = examples.flatMap(row => [{ ...row, id: row.id + ':error' }, ...(row.input === row.target ? [] : [{ ...row, id: row.id + ':identity', input: row.target, category: 'identity' }])]);
const previousCache = new Map<string, ReturnType<typeof createExperimentFallback>>();
const evaluate = (bundle: ExperimentBundle, additive = true): QualityRow[] => {
  const cache = new Map<string, ReturnType<typeof createExperimentFallback>>();
  return cases.map(row => {
    const key = JSON.stringify(row.protectedTerms ?? []);
    if (bundle && !cache.has(key)) cache.set(key, additive ? createDomainHead(bundle, row.protectedTerms) : createExperimentFallback(bundle, row.protectedTerms));
    if (!previousCache.has(key)) previousCache.set(key, createExperimentFallback(baseline, row.protectedTerms));
    const fallback = cache.get(key)!;
    return { ...row, actual: correctText(row.input, process.argv.includes('--preserve-formatting'), { useBounded: false, neuralFallback: additive ? (raw, tokens, at) => previousCache.get(key)!(raw, tokens, at) ?? fallback(raw, tokens, at) : fallback }).text };
  });
};
const before = evaluate(baseline, false), after = evaluate(candidate);
const previous = qualityReport(before), next = qualityReport(after);
const newlyWrong = newFalseEditRows(before, after);
const regressions = after.filter((row, at) => before[at].actual === row.target && row.actual !== row.target).map(row => row.id);
const gains = after.filter((row, at) => before[at].actual !== row.target && row.actual === row.target).map(row => row.id);
const report = { source: external ? 'External frozen references with synthetic noise; not real-user accuracy' : 'Assistant-authored synthetic references under delegated review; not blind real-error accuracy',
  baseline: 'Previous production spelling fallback; candidate only on its abstentions',
  split: external ?? (fresh.length ? 'fresh-context' : split ?? 'all; training rows descriptive only'), inputSHA256: checksum(JSON.stringify(cases)),
  before: previous.overall, after: next.overall, newFalseEditRows: newlyWrong, regressions, gains,
  rows: after.map((row, at) => ({ ...row, before: before[at].actual })) };
mkdirSync(dirname(output), { recursive: true }); atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log({ split: report.split, rows: cases.length, before: previous.overall.exact, after: next.overall.exact, newWrong: newlyWrong.length, regressions: regressions.length, gains: gains.length });
if (process.argv.includes('--enforce') && (newlyWrong.length || regressions.length || next.overall.identityChanged > previous.overall.identityChanged
  || next.overall.precision !== null && previous.overall.precision !== null && next.overall.precision < previous.overall.precision)) throw new Error('Domain neural release introduced a regression.');
