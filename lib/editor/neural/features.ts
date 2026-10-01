import { fold, type Token } from '../local-ai/core';
import { pairedFeatures, normalizeDigraphs, type PairedModel } from '../local-ai/paired';
import { boundedEditDistance } from '../spelling-candidates';
import type { MorphologicalFeatures } from '../contracts/morphology';
export const FEATURE_VERSION = 1;
export const skeleton = (word: string) => fold(normalizeDigraphs(word)).replace(/[aeiou]/gu, '');
export function neuralIndex(model: PairedModel): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const word of Object.keys(model.words).sort()) {
    const key = skeleton(word); if (key.length < 2) continue;
    const values = index.get(key) ?? []; if (values.length < 24) values.push(word); index.set(key, values);
  }
  return index;
}
export function neuralCandidates(model: PairedModel, index: Map<string, string[]>, raw: string): string[] {
  const input = fold(normalizeDigraphs(raw));
  return [...new Set([...Object.keys(model.edits[raw.toLocaleLowerCase('az-AZ')] ?? {}), ...(index.get(skeleton(raw)) ?? [])])]
    .filter(word => boundedEditDistance(input, fold(word), 4) <= 4 && word !== raw.toLocaleLowerCase('az-AZ')).slice(0, 24);
}
export function lexicalFeatures(model: PairedModel, raw: string, target: string, tokens: readonly Token[], at: number): number[] {
  const base = pairedFeatures(model, raw, target, tokens, at);
  const context = tokens.slice(Math.max(0, at - 5), at + 6).filter(token => token !== tokens[at] && token.sentence === tokens[at].sentence);
  const bins = Array(12).fill(0);
  for (const token of context) {
    const text = fold(token.word); let hash = 2166136261;
    for (const letter of text) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619) >>> 0;
    bins[hash % bins.length] += 0.2;
  }
  return [...base.map(value => value / 4), (raw.length - target.length) / 4,
    Number(skeleton(raw) === skeleton(target)), ...bins];
}
export interface Subject { person: 1 | 2 | 3; number: 'singular' | 'plural' }
export const subjects: Record<string, Subject> = {
  mən: { person: 1, number: 'singular' }, sən: { person: 2, number: 'singular' }, o: { person: 3, number: 'singular' },
  biz: { person: 1, number: 'plural' }, siz: { person: 2, number: 'plural' }, onlar: { person: 3, number: 'plural' },
};
export function agreementFeatures(subject: Subject, verb: Readonly<MorphologicalFeatures>): number[] {
  return [Number(subject.person === 1), Number(subject.person === 2), Number(subject.person === 3), Number(subject.number === 'plural'),
    Number(verb.person === 1), Number(verb.person === 2), Number(verb.person === 3), Number(verb.number === 'plural'),
    Number(subject.person === verb.person), Number(subject.number === verb.number),
    Number(verb.tense === 'past'), Number(verb.tense === 'present'), Number(verb.tense === 'future'), Number(verb.polarity === 'negative')];
}
