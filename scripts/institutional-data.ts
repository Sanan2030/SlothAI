import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import { isForeignTechnicalStem } from '../lib/editor/technical';
import type { CorrectionPair } from '../lib/editor/local-ai/paired';
import { normalizedText, similarity } from './neural-data-quality';

export const INSTITUTION_CORPUS = 'data/nlp/institutions/corpus.json';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export interface InstitutionSentence { id: string; documentId: string; domain: string; split: 'train' | 'validation' | 'test'; target: string; protectedTerms: string[]; annotationStatus: string; errorOrigin: string }
export function readInstitutionSentences(): InstitutionSentence[] {
  const raw = readFileSync(INSTITUTION_CORPUS, 'utf8');
  if (digest(raw) !== readFileSync(INSTITUTION_CORPUS + '.sha256', 'utf8').trim()) throw new Error('Frozen institutional scenarios changed.');
  const data = JSON.parse(raw) as { version: number; sentences: InstitutionSentence[] };
  if (data.version !== 1 || data.sentences.length !== 120) throw new Error('Unsupported institutional corpus.');
  const seen = new Set<string>(), owners = new Map<string, string>();
  for (const row of data.sentences) {
    if (!['train', 'validation', 'test'].includes(row.split) || row.annotationStatus !== 'assistant-authored-not-human-reviewed'
      || row.errorOrigin !== 'synthetic' || !/^[^\n]{20,240}\.$/u.test(row.target)) throw new Error('Invalid institutional example: ' + row.id);
    const key = normalizedText(row.target);
    if (seen.has(key) || owners.has(row.documentId)) throw new Error('Duplicate scenario or target: ' + row.id);
    seen.add(key); owners.set(row.documentId, row.split);
  }
  for (let i = 0; i < data.sentences.length; i++) for (let j = i + 1; j < data.sentences.length; j++)
    if (similarity(data.sentences[i].target, data.sentences[j].target) >= 0.72) throw new Error('Near-duplicate institutional targets.');
  return data.sentences;
}
export function institutionPairs(sentences: readonly InstitutionSentence[]): CorrectionPair[] {
  const pairs: CorrectionPair[] = [], seen = new Set<string>();
  for (const row of sentences) for (const mode of ['identity', 'ascii', 'digraph', 'delete-vowel', 'repeat', 'swap']) {
    const protectedWord = (word: string) => row.protectedTerms.includes(word) || /^[\p{Lu}\d]+$/u.test(word)
      || Boolean(canonicalProtectedTerm(word)) || isForeignTechnicalStem(word);
    let input = row.target;
    if (mode === 'ascii' || mode === 'digraph') input = input.replace(/\p{L}+/gu, word => {
      if (protectedWord(word)) return word;
      const raw = mode === 'digraph' ? word.replace(/ş/giu, 'sh').replace(/ç/giu, 'ch').replace(/ğ/giu, 'gh') : word;
      const variant = fold(raw);
      return /^\p{Lu}/u.test(word) ? variant[0].toLocaleUpperCase('az-AZ') + variant.slice(1) : variant;
    });
    else if (mode !== 'identity') {
      const eligible = tokenize(input).filter(token => token.word.length >= 6 && !protectedWord(token.word));
      if (!eligible.length) continue;
      const token = eligible[Number.parseInt(digest(row.id + mode).slice(0, 8), 16) % eligible.length];
      const word = token.word;
      const at = mode === 'delete-vowel' ? [...word].findIndex((letter, index) => index > 0 && index < word.length - 1 && /[aəeıioöuü]/u.test(letter)) : 2;
      if (at < 0) continue;
      const variant = mode === 'delete-vowel' ? word.slice(0, at) + word.slice(at + 1)
        : mode === 'repeat' ? word.slice(0, at) + word[at] + word.slice(at)
        : word.slice(0, at) + word[at + 1] + word[at] + word.slice(at + 2);
      input = input.slice(0, token.start) + variant + input.slice(token.end);
    }
    const key = digest(input + '\n' + row.target);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ id: row.id + ':' + mode, groupId: row.documentId, split: row.split, input, target: row.target });
  }
  return pairs;
}
