import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { edits } from './nlp/metrics';
import { foldLetters } from '../lib/editor/dictionary';
// Type-only import: the trainer never loads or uses its own previous artifact.
import type { ChannelRule, ObservedChannelModel } from '../lib/editor/observed-channel';
const filename = process.argv[2] ?? 'data/nlp/real/observed-spelling.json';
const output = process.argv[3] ?? 'lib/editor/observed-channel-model.json';
const raw = readFileSync(filename, 'utf8');
const data = JSON.parse(raw) as { cases: { id: string; documentId: string; split: string; input: string; target: string; annotationStatus: string; origin: string }[] };
const rules = new Map<string, ChannelRule>(), accents = new Map<string, ChannelRule>(), seen = new Set<string>(), documents = new Set<string>(), vocabulary = new Set<string>();
function add(map: Map<string, ChannelRule>, input: string, target: string) {
  for (const edit of edits([...input], [...target])) {
    const from = input.slice(edit.start, edit.end), to = edit.replacement.join('');
    if (from.length > 3 || to.length > 3) continue;
    const rule = { from, to, left: edit.start ? input[edit.start - 1] : '^', right: input[edit.end] ?? '$', count: 1 };
    const key = JSON.stringify([from, to, rule.left, rule.right]);
    const previous = map.get(key); if (previous) previous.count++; else map.set(key, rule);
  }
}
const documentSplits = new Map<string, string>();
for (const row of data.cases) {
  const old = documentSplits.get(row.documentId);
  if (old && old !== row.split) throw new Error('Document leakage between train and evaluation.');
  if (!['train', 'validation', 'test'].includes(row.split)) throw new Error('Unknown source partition.');
  documentSplits.set(row.documentId, row.split);
  if (row.split !== 'train') continue;
  if (row.annotationStatus !== 'assistant-reviewed' || row.origin !== 'observed-user-input' || !row.documentId) throw new Error('Unreviewed or synthetic source cannot train the observed channel.');
  const input = row.input.normalize('NFC').toLocaleLowerCase('az-AZ'), target = row.target.normalize('NFC').toLocaleLowerCase('az-AZ');
  if (!/^[\p{L}]{2,32}$/u.test(input) || !/^[\p{L}]{2,32}$/u.test(target)) throw new Error('Train aligned spelling spans, not document layouts.');
  const key = input + '\n' + target; if (seen.has(key)) throw new Error('Duplicate observed spelling pair.'); seen.add(key); documents.add(row.documentId); vocabulary.add(target);
  add(rules, foldLetters(input), foldLetters(target));
  if (input.length === target.length) for (let at = 0; at < input.length; at++) if (/[əıçğöşü]/u.test(input[at]) && input[at] !== target[at]) {
    const rule = { from: input[at], to: target[at], left: input[at - 1] ?? '^', right: input[at + 1] ?? '$', count: 1 };
    const key = JSON.stringify(rule); if (!accents.has(key)) accents.set(key, rule);
  }
}
if (!documents.size) throw new Error('No reviewed training documents.');
const artifact: ObservedChannelModel = { version: 1, vocabulary: [...vocabulary].sort(), rules: [...rules.values()].sort((a, b) => b.count - a.count || JSON.stringify(a).localeCompare(JSON.stringify(b))), accentRules: [...accents.values()],
  trainingSHA256: createHash('sha256').update(raw).digest('hex'), documents: documents.size, examples: seen.size };
writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ examples: artifact.examples, documents: artifact.documents, rules: artifact.rules.length, accents: artifact.accentRules.length, output }));
