import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksum, corrupt, type Category } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { parseDomainCorpus, auditDomainOverlap } from './nlp/domain-data';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = option('base'), output = option('output');
if (!base || !output) throw new Error('Use --base=frozen-reviewed-splits --output=domain-splits');
const manifest = verifyManifest(base), manifestRaw = readFileSync(resolve(base, 'manifest.json'), 'utf8');
const raw = readFileSync('data/nlp/domain/az-domain-001.json', 'utf8'), domain = parseDomainCorpus(raw);
interface Row { id: string; documentId: string; split: string; input: string; target: string; category: string; protectedTerms?: string[] }
const original: Row[] = ['train', 'validation', 'test'].flatMap(split => readFileSync(resolve(base, split + '.jsonl'), 'utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line)));
if (domain.some(row => manifest.documents.some(doc => doc.documentId === row.documentId))) throw new Error('Domain document collides with previous source ownership.');
auditDomainOverlap(domain, original);
const rows: Row[] = [...original, ...domain];
for (const row of domain.filter(row => row.split === 'train')) {
  rows.push({ ...row, id: row.id + ':identity', input: row.target, category: 'identity' });
  for (const category of ['diacritics', 'delete', 'insert', 'swap', 'keyboard', 'space'] as Category[]) for (let variant = 0; variant < 2; variant++) {
    const input = corrupt(row.target, category, `${row.id}:${category}:${variant}`, row.protectedTerms);
    if (input !== row.target) rows.push({ ...row, id: row.id + ':' + category + ':' + variant, input, category });
  }
}
const seen = new Set<string>(), unique = rows.filter(row => {
  const key = checksum(row.input.normalize('NFC') + '\n' + row.target.normalize('NFC'));
  if (seen.has(key)) return false;
  seen.add(key); return true;
});
mkdirSync(output, { recursive: true });
const partitions = Object.fromEntries(['train', 'validation', 'test'].map(split => {
  const selected = unique.filter(row => row.split === split), contents = selected.map(row => JSON.stringify(row)).join('\n') + '\n';
  atomicWriteSync(resolve(output, split + '.jsonl'), contents);
  return [split, { rows: selected.length, sha256: checksum(contents) }];
}));
const result = { ...JSON.parse(manifestRaw), partitions, documents: [...manifest.documents,
  ...domain.map(row => ({ documentId: row.documentId, split: row.split, cluster: checksum(row.documentId) }))],
  parentManifestSHA256: checksum(manifestRaw), domainCorpusSHA256: checksum(raw),
  domainReview: { examples: 100, training: 80, validation: 10, test: 10, annotationStatus: 'assistant-reviewed',
    authorization: 'User delegated authoring, review and training; not individually user-attested targets or real errors' },
  policy: 'Existing ownership retained; new 80/10/10 document ownership; cross-source near duplicates rejected; training-only augmentation; exact pairs deduplicated',
  addedRows: unique.length - original.length, removedDuplicatePairs: rows.length - unique.length };
atomicWriteSync(resolve(output, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
verifyManifest(output);
console.log({ partitions, addedRows: result.addedRows, removedDuplicatePairs: result.removedDuplicatePairs });
