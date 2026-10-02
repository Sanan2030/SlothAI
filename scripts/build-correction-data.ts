import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildData, checksum, type CleanDocument } from './nlp/data';
import { atomicWriteSync } from './atomic-files.mjs';
const [source, destination, variantsArg] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: npm run nlp:data -- documents.jsonl output-directory [variants=4]');
const sourceText = readFileSync(source, 'utf8');
const documents = sourceText.split(/\r?\n/u).filter(line => line.trim()).map((line, at) => {
  const value = JSON.parse(line) as CleanDocument;
  if (!value || ['documentId', 'text', 'source', 'license'].some(key => typeof value[key as keyof CleanDocument] !== 'string')) throw new Error(`Invalid document at line ${at + 1}`);
  if (value.protectedTerms !== undefined && (!Array.isArray(value.protectedTerms) || value.protectedTerms.some(term => typeof term !== 'string'))) throw new Error(`Invalid protectedTerms at line ${at + 1}`);
  return value;
});
const { rows, report, assignments } = buildData(documents, variantsArg === undefined ? 4 : Number(variantsArg));
if (!rows.length) throw new Error('No sentence-sized examples were produced.');
const out = resolve(destination); mkdirSync(out, { recursive: true });
const partitions = Object.fromEntries(['train', 'validation', 'test'].map(split => {
  const selected = rows.filter(row => row.split === split), contents = selected.map(row => JSON.stringify(row)).join('\n') + (selected.length ? '\n' : '');
  atomicWriteSync(resolve(out, split + '.jsonl'), contents);
  return [split, { sha256: checksum(contents), rows: selected.length }];
}));
atomicWriteSync(resolve(out, 'manifest.json'), JSON.stringify({ version: 2, ...report, partitions, documents: assignments,
  sourceSHA256: checksum(sourceText), outputSHA256: checksum(JSON.stringify(rows)),
  note: 'Document/near-duplicate clusters are assigned before augmentation. Never copy held-out rows into training.' }, null, 2) + '\n');
console.log(report);
