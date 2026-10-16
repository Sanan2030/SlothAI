/** Measure a fixed export on the accepted validation split; never tune it here. */
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { BrowserWordLM, wordLMTokens } from '../lib/editor/wordlm/core';
import artifact from '../lib/editor/wordlm/model.json';
import fullReceipt from '../docs/training/wordlm-full-2026-10-17.json';

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: evaluate-wordlm-browser.ts validation.jsonl report.json');
  const manifestBytes = readFileSync('docs/stage1/collection/MANIFEST.json');
  if (createHash('sha256').update(manifestBytes).digest('hex') !== artifact.manifestSHA256) throw new Error('Manifest hash mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const expected = manifest.files['validation.jsonl'];
  const digest = createHash('sha256'); let bytes = 0;
  for await (const block of createReadStream(input)) { digest.update(block); bytes += block.length; }
  if (bytes !== expected.bytes || digest.digest('hex') !== expected.sha256) throw new Error('Validation hash mismatch');
  const model = new BrowserWordLM(artifact);
  const sources = new Set(Object.entries(manifest.assignments).filter(([, split]) => split === 'validation').map(([id]) => id));
  let rows = 0, predictions = 0, zero = 0, logLikelihood = 0;
  for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    if (!sources.has(row.sourceId)) throw new Error('Validation source crosses split');
    const sequence = ['<s>', '<s>', ...wordLMTokens(row.text), '</s>'].map(w => model.mapped(w));
    for (let i = 2; i < sequence.length; i++) {
      const p = model.probability(sequence[i - 2], sequence[i - 1], sequence[i]);
      predictions++; if (!(p > 0) || !Number.isFinite(p)) zero++; else logLikelihood += Math.log(p);
    }
    rows++;
  }
  if (rows !== manifest.splitCounts.validation) throw new Error('Validation row coverage mismatch');
  if (predictions !== fullReceipt.validationPredictions) throw new Error('Tokenization differs from full-model validation');
  const result = { rows, predictions, zeroProbabilityTokens: zero,
    perplexity: zero ? null : Math.exp(-logLikelihood / predictions),
    artifactSHA256: createHash('sha256').update(readFileSync('lib/editor/wordlm/model.json')).digest('hex'),
    inputSHA256: expected.sha256, testRead: false, calibrationPerformed: false,
    scope: 'Fixed browser projection; mapped vocabulary/suffix classes, not correction accuracy' };
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(result);
  if (zero || !Number.isFinite(result.perplexity)) process.exitCode = 1;
}
void main();
