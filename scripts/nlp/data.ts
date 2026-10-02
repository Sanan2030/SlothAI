import { createHash } from 'node:crypto';
export type Split = 'train' | 'validation' | 'test';
export type Category = 'identity' | 'diacritics' | 'delete' | 'insert' | 'swap' | 'keyboard' | 'space' | 'colloquial';
export interface CleanDocument {
  documentId: string; text: string; source: string; license: string;
  protectedTerms?: string[];
}
export interface DataRow {
  id: string; documentId: string; source: string; license: string; split: Split;
  category: Category; input: string; target: string; protectedTerms?: string[];
}
export const checksum = (text: string) => createHash('sha256').update(text).digest('hex');
const normalization = (text: string) => text.normalize('NFC').toLocaleLowerCase('az-AZ').replace(/\s+/gu, ' ').trim();
const folded = (text: string) => normalization(text).replace(/[əıçğöşü]/gu, letter => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[letter]!);
const bigrams = (text: string) => {
  const tokens = folded(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(tokens.length < 2 ? tokens : tokens.slice(1).map((word, at) => tokens[at] + ' ' + word));
};
function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(value => b.has(value)).length;
  return intersection / Math.max(1, a.size + b.size - intersection);
}
export function random(seed: string): () => number {
  let state = parseInt(checksum(seed).slice(0, 8), 16) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
/** Cluster shared paragraphs and document near duplicates before any augmentation. */
export function splitDocuments(documents: readonly CleanDocument[]) {
  const ids = new Set<string>();
  for (const doc of documents) {
    if (!doc.documentId || !doc.text.trim() || !doc.source || !doc.license) throw new Error('Each document needs documentId, text, source and license.');
    if (ids.has(doc.documentId)) throw new Error('Duplicate documentId: ' + doc.documentId); ids.add(doc.documentId);
  }
  const parent = documents.map((_, at) => at);
  const root = (at: number): number => { while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; } return at; };
  const join = (a: number, b: number) => { parent[root(b)] = root(a); };
  const exact = new Map<string, number>(), paragraphs = new Map<string, number>();
  const shingles = documents.map(doc => bigrams(doc.text));
  const postings = new Map<string, number[]>(), duplicateIds = new Set<string>();
  documents.forEach((doc, at) => {
    const key = checksum(normalization(doc.text)), previous = exact.get(key);
    if (previous !== undefined) { join(at, previous); duplicateIds.add(doc.documentId); } else exact.set(key, at);
    for (const paragraph of doc.text.split(/\n\s*\n/gu)) {
      if (paragraph.trim().length < 40) continue;
      const hash = checksum(folded(paragraph)), old = paragraphs.get(hash);
      if (old !== undefined) join(at, old); else paragraphs.set(hash, at);
    }
    for (const sentence of sentenceUnits(doc.text, doc.protectedTerms)) {
      if (sentence.trim().length < 20) continue;
      const hash = checksum('sentence:' + folded(sentence)), old = paragraphs.get(hash);
      if (old !== undefined) join(at, old); else paragraphs.set(hash, at);
    }
    const candidates = new Set<number>();
    for (const shingle of shingles[at]) for (const old of postings.get(shingle) ?? []) candidates.add(old);
    for (const old of candidates) if (jaccard(shingles[at], shingles[old]) >= 0.8) join(at, old);
    for (const shingle of shingles[at]) { const values = postings.get(shingle) ?? []; values.push(at); postings.set(shingle, values); }
  });
  const groups = new Map<number, string[]>();
  documents.forEach((doc, at) => { const group = groups.get(root(at)) ?? []; group.push(doc.documentId); groups.set(root(at), group); });
  const assignments = documents.map((doc, at) => {
    const cluster = [...groups.get(root(at))!].sort().join('\n');
    const bucket = parseInt(checksum('split-v1:' + cluster).slice(0, 8), 16) / 4294967296;
    return { ...doc, split: (bucket < 0.8 ? 'train' : bucket < 0.9 ? 'validation' : 'test') as Split, cluster: checksum(cluster) };
  });
  return { documents: assignments.filter(doc => !duplicateIds.has(doc.documentId)), removedExactDuplicates: [...duplicateIds], clusters: groups.size };
}
const substitutions: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ç: 'c', ş: 's', ğ: 'g', Ə: 'E', Ö: 'O', Ü: 'U', Ç: 'C', Ş: 'S', Ğ: 'G', İ: 'I' };
const keyboard: Record<string, string> = { a: 'sq', s: 'adw', d: 'sfe', f: 'dgr', g: 'fht', h: 'gjy', j: 'hku', k: 'jli', l: 'ko', q: 'wa', w: 'qes', e: 'wrd', r: 'etf', t: 'ryg', y: 'tuh', u: 'yij', i: 'uok', o: 'ipl', p: 'ol', z: 'xa', x: 'zcs', c: 'xvd', v: 'cbf', b: 'vng', n: 'bmh', m: 'nj' };
const colloquial: Record<string, string> = { sonra: 'sora', gəlirəm: 'gəliram', istəyirəm: 'istiyirəm', deyil: 'diyil' };
/** Conservative training protection; not a general named-entity recognizer. */
export function protectedMask(text: string, terms: readonly string[] = []): boolean[] {
  const mask = Array<boolean>(text.length).fill(false);
  const pattern = /```[\s\S]*?```|`[^`\n]*`|<[^>]+>|https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\d+(?:[.,:/-]\d+)*|\p{Lu}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)?/gu;
  for (const match of text.matchAll(pattern)) for (let at = match.index; at < match.index + match[0].length; at++) mask[at] = true;
  for (const term of terms) {
    if (!term) continue;
    const lower = text.toLocaleLowerCase('az-AZ'), needle = term.toLocaleLowerCase('az-AZ'); let start = 0;
    while ((start = lower.indexOf(needle, start)) >= 0) {
      for (let at = start; at < start + term.length; at++) mask[at] = true; start += term.length;
    }
  }
  return mask;
}
export function corrupt(text: string, category: Category, seed: string, protectedTerms: readonly string[] = []): string {
  if (category === 'identity') return text;
  const rng = random(seed), mask = protectedMask(text, protectedTerms);
  const choose = <T>(values: readonly T[]) => values.length ? values[Math.floor(rng() * values.length)] : undefined;
  const tokens = [...text.matchAll(/[\p{L}\p{M}]+/gu)].filter(match => !mask.slice(match.index, match.index + match[0].length).some(Boolean));
  const word = choose(tokens.filter(match => match[0].length >= 4));
  if (category === 'diacritics') return text.replace(/[əıöüçşğƏÖÜÇŞĞİ]/gu, (letter, at: number) => !mask[at] && rng() < 0.85 ? substitutions[letter] : letter);
  if (category === 'colloquial') {
    const match = choose(tokens.filter(token => colloquial[token[0]]));
    return match ? text.slice(0, match.index) + colloquial[match[0]] + text.slice(match.index + match[0].length) : text;
  }
  if (category === 'space') {
    const split = rng() < 0.5;
    if (split && word) { const at = word.index + 1 + Math.floor(rng() * (word[0].length - 1)); return text.slice(0, at) + ' ' + text.slice(at); }
    const spaces = [...text.matchAll(/(?<=\p{L}) (?=\p{L})/gu)].filter(match => !mask[match.index - 1] && !mask[match.index + 1]);
    const match = choose(spaces); return match ? text.slice(0, match.index) + text.slice(match.index + 1) : text;
  }
  if (!word) return text;
  let value = word[0]; const at = Math.floor(rng() * value.length);
  if (category === 'delete') value = value.slice(0, at) + value.slice(at + 1);
  if (category === 'insert') value = value.slice(0, at) + value[at] + value.slice(at);
  if (category === 'swap') {
    const positions = [...value].slice(0, -1).flatMap((letter, i) => letter !== value[i + 1] ? [i] : []), swap = choose(positions);
    if (swap === undefined) return text;
    value = value.slice(0, swap) + value[swap + 1] + value[swap] + value.slice(swap + 2);
  }
  if (category === 'keyboard') {
    const positions = [...value].flatMap((letter, i) => keyboard[letter] ? [i] : []), key = choose(positions);
    if (key === undefined) return text;
    const neighbors = keyboard[value[key]], replacement = choose([...neighbors])!;
    value = value.slice(0, key) + replacement + value.slice(key + 1);
  }
  return text.slice(0, word.index) + value + text.slice(word.index + word[0].length);
}
export function sentenceUnits(text: string, terms?: readonly string[]): string[] {
  const normalized = text.normalize('NFC'), mask = protectedMask(normalized, terms);
  const units: string[] = []; let start = 0;
  for (const match of normalized.matchAll(/[.!?]+(?=\s|$)|\n\s*\n/gu)) {
    if (mask.slice(match.index, match.index + match[0].length).some(Boolean)) continue;
    units.push(normalized.slice(start, match.index + match[0].length)); start = match.index + match[0].length;
  }
  if (start < normalized.length) units.push(normalized.slice(start));
  return units;
}
export function buildData(documents: readonly CleanDocument[], variants = 4) {
  if (!Number.isInteger(variants) || variants < 1 || variants > 32) throw new Error('variants must be 1..32.');
  const grouped = splitDocuments(documents), rows: DataRow[] = [], seen = new Set<string>(), owners = new Map<string, Split>();
  const categories: Category[] = ['diacritics', 'delete', 'insert', 'swap', 'keyboard', 'space', 'colloquial'];
  let repeatedTargets = 0;
  for (const doc of grouped.documents) {
    const units = sentenceUnits(doc.text, doc.protectedTerms);
    for (let unit = 0; unit < units.length; unit++) {
      const target = units[unit].trim(); if (target.length < 20 || target.length > 2000) continue;
      const targetHash = checksum(normalization(target)), owner = owners.get(targetHash);
      if (owner !== undefined) { if (owner !== doc.split) throw new Error('Shared sentence crosses document split: ' + doc.documentId); repeatedTargets++; continue; }
      owners.set(targetHash, doc.split);
      for (let variant = 0; variant <= variants; variant++) {
        const weighted: Category[] = ['diacritics', 'diacritics', 'diacritics', 'diacritics', 'diacritics', ...categories];
        const category = variant === 0 ? 'identity' : weighted[Math.floor(random(`${doc.documentId}:${unit}:${variant}:category`)() * weighted.length)];
        const input = corrupt(target, category, `${doc.documentId}:${unit}:${variant}`, doc.protectedTerms);
        if (category !== 'identity' && input === target) continue;
        const key = checksum(input + '\n' + target); if (seen.has(key)) continue; seen.add(key);
        rows.push({ id: checksum(doc.documentId + ':' + unit + ':' + variant).slice(0, 24), documentId: doc.documentId,
          source: doc.source, license: doc.license, split: doc.split, category, input, target, ...(doc.protectedTerms ? { protectedTerms: doc.protectedTerms } : {}) });
      }
    }
  }
  const counts = Object.fromEntries(['train', 'validation', 'test'].map(split => [split, rows.filter(row => row.split === split).length]));
  return { rows, assignments: grouped.documents.map(doc => ({ documentId: doc.documentId, split: doc.split, cluster: doc.cluster })), report: { sourceDocuments: documents.length, keptDocuments: grouped.documents.length, clusters: grouped.clusters,
    removedExactDuplicates: grouped.removedExactDuplicates, repeatedTargets, counts, categories: Object.fromEntries(['identity', ...categories].map(category => [category, rows.filter(row => row.category === category).length])),
    limitations: 'Synthetic noise; no real-user accuracy claim. Capitalized words are conservatively protected, including sentence-initial words. Supply protectedTerms for lowercase names and foreign words. Near duplicates clustered at document token-bigram Jaccard >=0.8; exact sentences audited across splits. Sentence segmentation protects URLs, code and numbers but is not a full abbreviation model. Noise frequencies are illustrative, not estimated from real errors.' } };
}
