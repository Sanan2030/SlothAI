import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomicWriteSync } from './atomic-files.mjs';
import { checksum, corrupt, type Category, type Split } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import { tokenize, fold } from '../lib/editor/local-ai/core';

const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option('source'), reviews = option('reviews'), output = option('output');
if (!source || !reviews || !output) throw new Error('Use --source=source-splits --reviews=approved-splits --output=merged-splits');
const sourceManifest = verifyManifest(source), reviewManifest = verifyManifest(reviews);
interface Row { id: string; documentId: string; split: Split; input: string; target: string; category: string; protectedTerms?: string[]; [key: string]: unknown }
const readRows = (directory: string, split: Split): Row[] => readFileSync(resolve(directory, split + '.jsonl'), 'utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line) as Row);
const splits: Split[] = ['train', 'validation', 'test'];
for (const row of splits.flatMap(split => readRows(reviews, split))) {
  if (row.annotationStatus !== 'user-attested' || typeof row.reviewedBy !== 'string' || !row.reviewedBy.trim()
    || typeof row.reviewedAt !== 'string' || !Number.isFinite(Date.parse(row.reviewedAt))) {
    throw new Error('Reviewed augmentation requires explicit user approval and a review date.');
  }
}
const rows = splits.flatMap(split => [...readRows(source, split), ...readRows(reviews, split)]);
const assignments = [...sourceManifest.documents, ...reviewManifest.documents];
const documents = new Set<string>();
for (const doc of assignments) {
  if (documents.has(doc.documentId)) throw new Error('Source/review document ID collision');
  documents.add(doc.documentId);
}
const normalized = (text: string) => fold(text.normalize('NFC')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const targets = new Map<string, Split>();
for (const row of rows) {
  const key = normalized(row.target), previous = targets.get(key);
  if (previous && previous !== row.split) throw new Error('Cross-source target leakage');
  targets.set(key, row.split);
}
// Upstream source and review manifests already cluster their own near duplicates.
// Audit cross-source overlap as well before adding any synthetic error variants.
const bigrams = (text: string) => {
  const words = normalized(text).split(' ');
  return new Set(words.slice(1).map((word, at) => words[at] + ' ' + word));
};
const sourceRows = splits.flatMap(split => readRows(source, split));
const reference = [...new Map(sourceRows.map(row => [normalized(row.target), { row, grams: bigrams(row.target) }])).values()];
for (const row of splits.flatMap(split => readRows(reviews, split))) {
  const grams = bigrams(row.target);
  if (grams.size < 3) continue;
  for (const other of reference) {
    const common = [...grams].filter(value => other.grams.has(value)).length;
    const similarity = common / (grams.size + other.grams.size - common);
    if (similarity >= 0.8 && other.row.split !== row.split) throw new Error('Cross-source near-duplicate leakage');
  }
}
const augmentation: Category[] = ['diacritics', 'delete', 'insert', 'swap', 'keyboard', 'space'];
for (const row of readRows(reviews, 'train')) {
  const protectedTerms = [...new Set(tokenize(row.target).map(token => token.word).filter(word => canonicalProtectedTerm(word)))];
  rows.push({ ...row, id: row.id + ':identity', input: row.target, category: 'identity', protectedTerms });
  for (const category of augmentation) for (let variant = 0; variant < 2; variant++) {
    const input = corrupt(row.target, category, `${row.id}:${category}:${variant}`, protectedTerms);
    if (input !== row.target) rows.push({ ...row, id: `${row.id}:${category}:${variant}`, input, category, protectedTerms,
      provenance: 'Synthetic augmentation of user-approved training target; never validation/test augmentation' });
  }
}
const unique: Row[] = [], seen = new Set<string>();
for (const row of rows) {
  const key = checksum(row.input.normalize('NFC') + '\n' + row.target.normalize('NFC'));
  if (seen.has(key)) continue;
  seen.add(key); unique.push(row);
}
const destination = resolve(output); mkdirSync(destination, { recursive: true });
const partitions = Object.fromEntries(splits.map(split => {
  const selected = unique.filter(row => row.split === split), contents = selected.map(row => JSON.stringify(row)).join('\n') + '\n';
  atomicWriteSync(resolve(destination, split + '.jsonl'), contents);
  return [split, { rows: selected.length, sha256: checksum(contents) }];
}));
const manifest = { version: 2, documents: assignments, partitions,
  sourceManifestSHA256: checksum(readFileSync(resolve(source, 'manifest.json'), 'utf8')),
  reviewManifestSHA256: checksum(readFileSync(resolve(reviews, 'manifest.json'), 'utf8')),
  policy: 'Existing document splits retained; cross-source exact/near targets audited; only train reviewed targets augmented; exact pairs deduplicated',
  addedRows: unique.length - sourceRows.length, removedDuplicatePairs: rows.length - unique.length };
atomicWriteSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
verifyManifest(destination);
console.log({ partitions, addedRows: manifest.addedRows, removedDuplicatePairs: manifest.removedDuplicatePairs });
