import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewedDataset } from './nlp/reviewed-data';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option('input'), output = option('output');
if (!source || !output) throw new Error('Use --input=review-file.json --output=split-directory --provenance=source --reviewed-by=reviewer --license=license [--exclude=held-out.jsonl]');
const exclude = option('exclude');
const excludedTargets = exclude ? readFileSync(exclude, 'utf8').split(/\r?\n/u).filter(Boolean).map(line => {
  const row = JSON.parse(line) as { target: string }; if (typeof row.target !== 'string') throw new Error('Excluded rows need target.'); return row.target;
}) : [];
const result = reviewedDataset(readFileSync(source, 'utf8'), option('provenance') ?? '', option('reviewed-by') ?? '', option('license') ?? '', excludedTargets);
if (!result.manifest.review.accepted) throw new Error('No explicitly approved eligible text pairs. Review the targets; raw logs and legacy exports are not training gold.');
const destination = resolve(output); mkdirSync(destination, { recursive: true });
for (const [split, partition] of Object.entries(result.partitions)) atomicWriteSync(resolve(destination, split + '.jsonl'), partition.contents);
atomicWriteSync(resolve(destination, 'manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
console.log(result.manifest.review);
