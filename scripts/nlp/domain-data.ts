import { fold, tokenize } from '../../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../../lib/editor/protected-terminology';
import { splitDocuments, type Split } from './data';
export interface DomainRow {
  id: string; documentId: string; split: Split; domain: string; input: string; target: string;
  category: string; annotationStatus: 'assistant-reviewed'; reviewedBy: string; reviewedAt: string;
  provenance: string; protectedTerms: string[];
}
const normalized = (text: string) => fold(text.normalize('NFC')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const bigrams = (text: string) => { const words = normalized(text).split(' '); return new Set(words.slice(1).map((word, at) => words[at] + ' ' + word)); };
/** Reject copied references, including near copies with changed names. */
export function auditDomainOverlap(rows: readonly { target: string; documentId: string }[], existing: readonly { target: string; documentId: string }[] = []): void {
  const reference = [...new Map(existing.map(row => [normalized(row.target), row])).values()]
    .map(row => ({ ...row, key: normalized(row.target), grams: bigrams(row.target) }));
  for (const row of rows) {
    const key = normalized(row.target), grams = bigrams(row.target);
    for (const other of reference) {
      if (row.documentId === other.documentId) continue;
      const common = [...grams].filter(value => other.grams.has(value)).length;
      if (key === other.key || grams.size >= 3 && other.grams.size >= 3 && common / (grams.size + other.grams.size - common) >= 0.8) {
        throw new Error('Domain reference duplicates another document: ' + row.documentId + ' / ' + other.documentId);
      }
    }
    reference.push({ ...row, key, grams });
  }
}
export function parseDomainCorpus(raw: string): DomainRow[] {
  const corpus = JSON.parse(raw) as { version: number; authorization: string; license: string; cases: DomainRow[] };
  if (corpus.version !== 1 || !corpus.authorization?.trim() || !corpus.license?.trim()
    || !Array.isArray(corpus.cases) || corpus.cases.length !== 100) throw new Error('Expected 100 explicitly delegated domain references.');
  const ids = new Set<string>(), inputs = new Set<string>();
  for (const row of corpus.cases) {
    if (!row.id || row.documentId !== row.id || ids.has(row.id)
      || !['train', 'validation', 'test'].includes(row.split)
      || !['it', 'document-workflow', 'public-administration'].includes(row.domain)
      || typeof row.input !== 'string' || !row.input.trim() || row.input.length > 1200
      || typeof row.target !== 'string' || !row.target.trim() || row.target.length > 1200
      || row.annotationStatus !== 'assistant-reviewed' || !row.reviewedBy?.trim()
      || !Number.isFinite(Date.parse(row.reviewedAt)) || !row.provenance?.trim()
      || !Array.isArray(row.protectedTerms) || row.protectedTerms.some(term => typeof term !== 'string')) throw new Error('Invalid delegated domain reference: ' + row.id);
    const key = row.input.normalize('NFC').toLocaleLowerCase('az-AZ').replace(/\s+/gu, ' ').trim();
    if (inputs.has(key)) throw new Error('Duplicate domain input.');
    ids.add(row.id); inputs.add(key);
  }
  for (const [split, count] of [['train', 80], ['validation', 10], ['test', 10]] as const) {
    if (corpus.cases.filter(row => row.split === split).length !== count) throw new Error('Frozen domain ownership must remain 80/10/10.');
  }
  auditDomainOverlap(corpus.cases);
  const grouped = splitDocuments(corpus.cases.map(row => ({ documentId: row.id, text: row.target, source: row.provenance, license: corpus.license })));
  if (grouped.clusters !== 100) throw new Error('Domain documents contain repeated sentences or near duplicates.');
  return corpus.cases.map(row => ({ ...row, protectedTerms: [...new Set([...row.protectedTerms,
    ...tokenize(row.target).map(token => token.word).filter(word => canonicalProtectedTerm(word))])] }));
}
