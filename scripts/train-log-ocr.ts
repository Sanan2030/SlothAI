import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import corpus from '../data/nlp/logs/log-2026-10-05-training.json';
import { atomicWriteSync } from './atomic-files.mjs';

const mappings: Record<string, string> = {};
for (const row of corpus.ocrTokens) {
  const key = row.input.normalize('NFC').toLocaleLowerCase('az-AZ');
  if (!/^[a-zəçğıöşü]+(?: [a-zəçğıöşü]+)*$/u.test(row.target)) throw new Error('Invalid generic OCR target.');
  if (mappings[key] && mappings[key] !== row.target) throw new Error('Conflicting OCR labels.');
  mappings[key] = row.target;
}
const artifact = { version: 1, sourceSHA256: createHash('sha256').update(readFileSync('data/nlp/logs/log-2026-10-05-training.json')).digest('hex'),
  phrases: corpus.ocrPhrases, provenance: 'Assistant-reviewed observed OCR tokens; not human-reviewed. Generic words only. List-context gated empirical channel, not a neural semantic model.', mappings };
atomicWriteSync('lib/editor/log-ocr-model.json', JSON.stringify(artifact) + '\n');
console.log({ tokens: Object.keys(mappings).length, bytes: Buffer.byteLength(JSON.stringify(artifact) + '\n') });
