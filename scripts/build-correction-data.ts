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
const { rows, report } = buildData(documents, variantsArg === undefined ? 4 : Number(variantsArg));
if (!rows.length) throw new Error('No sentence-sized examples were produced.');
const out = resolve(destination); mkdirSync(out, { recursive: true });
for (const split of ['train', 'validation', 'test']) atomicWriteSync(resolve(out, split + '.jsonl'), rows.filter(row => row.split === split).map(row => JSON.stringify(row)).join('\n') + '\n');
atomicWriteSync(resolve(out, 'manifest.json'), JSON.stringify({ ...report, sourceSHA256: checksum(sourceText), outputSHA256: checksum(JSON.stringify(rows)),
  note: 'Documents are assigned before augmentation. Small inputs may have an empty validation/test partition; add independent documents, never copy rows across splits.' }, null, 2) + '\n');
console.log(report);
