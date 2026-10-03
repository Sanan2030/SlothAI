import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksum, random, type Split } from './data';
import { verifyManifest } from './manifest';
import { fold, tokenize } from '../../lib/editor/local-ai/core';
import { prepareBoundaryContext, eligibleBoundary, boundaryFeatures } from '../../lib/editor/neural/boundary-features';

export interface BoundaryDocument { documentId: string; text: string; split: Split; source: string }
export interface BoundaryRow { id: string; documentId: string; split: Split; x: number[]; y: number; variant: string }

/** Fixed document ownership precedes punctuation removal, never split individual gaps. */
export function loadBoundaryDocuments(sourceSplits: string, reviews: string): BoundaryDocument[] {
  const manifest = verifyManifest(sourceSplits), ownership = new Map(manifest.documents.map(doc => [doc.documentId, doc.split]));
  const source = readFileSync('data/nlp/wikipedia-documents.jsonl', 'utf8').split(/\r?\n/u).filter(Boolean)
    .map(line => JSON.parse(line) as { documentId: string; text: string; source: string });
  verifyManifest(reviews);
  const documents: BoundaryDocument[] = source.map(doc => {
    const split = ownership.get(doc.documentId);
    if (!split) throw new Error('Source article missing its frozen ownership.');
    return { ...doc, split };
  });
  for (const split of ['train', 'validation', 'test'] as const) for (const line of readFileSync(resolve(reviews, split + '.jsonl'), 'utf8').split(/\r?\n/u).filter(Boolean)) {
    const row = JSON.parse(line) as { documentId: string; target: string; reviewedBy: string; reviewedAt: string; annotationStatus: string };
    if (row.annotationStatus !== 'user-attested' || !row.reviewedBy || !Number.isFinite(Date.parse(row.reviewedAt))) throw new Error('Boundary training requires approved review targets.');
    documents.push({ documentId: row.documentId, split, text: row.target, source: 'owner-approved assistant-authored synthetic reference' });
  }
  auditBoundaryDocuments(documents);
  return documents;
}

/** Reject exact and near duplicates before generating any punctuation masks. */
export function auditBoundaryDocuments(documents: readonly BoundaryDocument[]): void {
  const targets = new Map<string, Split>();
  const ids = new Set<string>();
  for (const doc of documents) {
    if (ids.has(doc.documentId)) throw new Error('Duplicate boundary document ID.');
    ids.add(doc.documentId);
    const hash = checksum(fold(doc.text.normalize('NFC')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
    if (targets.has(hash) && targets.get(hash) !== doc.split) throw new Error('Boundary target leaks across document splits.');
    targets.set(hash, doc.split);
  }
  const signatures = documents.map(doc => {
    const words = fold(doc.text.normalize('NFC')).match(/[\p{L}\p{N}]+/gu) ?? [];
    return new Set(words.slice(1).map((word, at) => words[at] + ' ' + word));
  });
  for (let at = 0; at < documents.length; at++) for (let other = 0; other < at; other++) {
    if (documents[at].split === documents[other].split || signatures[at].size < 3 || signatures[other].size < 3) continue;
    const common = [...signatures[at]].filter(value => signatures[other].has(value)).length;
    if (common / (signatures[at].size + signatures[other].size - common) >= 0.8) {
      throw new Error('Near-duplicate boundary documents cross splits.');
    }
  }
}

/** Identity and partially punctuated inputs teach the model when to abstain. */
export function boundaryRows(documents: readonly BoundaryDocument[]): { rows: BoundaryRow[]; skippedStructuredDocuments: string[] } {
  const rows: BoundaryRow[] = [], skippedStructuredDocuments: string[] = [];
  const seen = new Set<string>();
  for (const doc of documents) {
    if (/[`<>|]/u.test(doc.text) || /^\s*#/mu.test(doc.text)) { skippedStructuredDocuments.push(doc.documentId); continue; }
    const target = doc.text.normalize('NFC'), goldTokens = tokenize(target);
    const labels = goldTokens.slice(0, -1).map((left, at) => Number(/[.!?]\s/u.test(target.slice(left.end, goldTokens[at + 1].start))));
    const rng = random('boundary-mask-v1:' + doc.documentId);
    const variants = [
      { name: 'unpunctuated', text: target.replace(/[.!?,;:]+/gu, ' ') },
      { name: 'partial', text: target.replace(/[.!?]+/gu, value => rng() < 0.5 ? value : ' ').replace(/[,;:]+/gu, ' ') },
      { name: 'identity', text: target },
    ];
    for (const variant of variants) {
      const input = variant.text.toLocaleLowerCase('az-AZ').replace(/\s+/gu, ' ').trim();
      const context = prepareBoundaryContext(input);
      if (context.tokens.length !== goldTokens.length) throw new Error('Punctuation corruption changed word alignment: ' + doc.documentId);
      for (let at = 0; at < context.tokens.length - 1; at++) {
        if (!eligibleBoundary(context, at)) continue;
        const key = checksum(input + '\n' + at + '\n' + labels[at]);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ id: key.slice(0, 24), documentId: doc.documentId, split: doc.split,
          x: boundaryFeatures(context, at), y: labels[at], variant: variant.name });
      }
    }
  }
  return { rows, skippedStructuredDocuments };
}
