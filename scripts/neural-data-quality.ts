import { fold } from '../lib/editor/local-ai/core';
import type { Example } from '../lib/editor/neural/network';
export const normalizedText = (text: string) => fold(text.normalize('NFC')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function similarity(left: string, right: string): number {
  const shingles = (text: string) => {
    const words = normalizedText(text).split(' ');
    return new Set(words.length < 2 ? words : words.slice(1).map((word, at) => words[at] + ' ' + word));
  };
  const a = shingles(left), b = shingles(right);
  const intersection = [...a].filter(value => b.has(value)).length;
  return intersection / Math.max(1, a.size + b.size - intersection);
}
export function uniqueExamples<T extends Example>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.filter(row => {
    const key = JSON.stringify(row.x);
    if (seen.has(key) && seen.get(key) !== row.y) throw new Error('Conflicting labels for identical neural features.');
    if (seen.has(key)) return false;
    seen.set(key, row.y); return true;
  });
}
export function auditPairs(rows: { id: string; split: string; input: string; target: string }[]) {
  const duplicates: string[][] = [], nearDuplicates: string[][] = [], splitLeaks: string[][] = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    const exact = normalizedText(a.input) === normalizedText(b.input) && normalizedText(a.target) === normalizedText(b.target);
    const near = similarity(a.target, b.target) >= 0.8;
    if (exact) duplicates.push([a.id, b.id]);
    else if (near) nearDuplicates.push([a.id, b.id]);
    if ((exact || near) && a.split !== b.split) splitLeaks.push([a.id, b.id]);
  }
  return { rows: rows.length, duplicates, nearDuplicates, splitLeaks };
}
