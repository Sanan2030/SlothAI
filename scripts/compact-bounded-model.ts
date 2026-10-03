import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { checksum } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { createExperimentPredictor, type ExperimentBundle } from './nlp/inference';
import { atomicWriteSync } from './atomic-files.mjs';
const [input, output, data] = process.argv.slice(2);
if (!input || !output || !data) throw new Error('Use selected-bundle.json output-bundle.json split-directory');
verifyManifest(data);
const manifestText = readFileSync(resolve(data, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText) as { reviewManifestSHA256?: string; sourceManifestSHA256?: string };
const original = JSON.parse(readFileSync(input, 'utf8')) as ExperimentBundle;
if (original.artifact.candidateMode !== 'bounded-edits' || original.artifact.lexiconSha256 !== checksum(JSON.stringify(original.lexicon))) throw new Error('Invalid bounded bundle fingerprint.');
const compact = structuredClone(original);
compact.lexicon.edits = {}; compact.lexicon.splits = {};
compact.lexicon.words = Object.fromEntries(Object.entries(compact.lexicon.words).filter(([word]) => /^[a-zəçğıöşü]{4,24}$/u.test(word)));
compact.artifact.lexiconSha256 = checksum(JSON.stringify(compact.lexicon));
const before = createExperimentPredictor(original), after = createExperimentPredictor(compact); let count = 0;
for (const split of ['train', 'validation', 'test']) for (const line of readFileSync(resolve(data, split + '.jsonl'), 'utf8').split(/\r?\n/u).filter(Boolean)) {
  const row = JSON.parse(line) as { id: string; input: string; protectedTerms?: string[] };
  if (before(row.input, row.protectedTerms) !== after(row.input, row.protectedTerms)) throw new Error('Compaction changed inference: ' + row.id);
  count++;
}
const bundle = { ...compact, provenance: { dataset: manifest.reviewManifestSHA256
  ? 'wikimedia/wikipedia 20231101.az + az-batch-001 user-approved synthetic training targets'
  : 'wikimedia/wikipedia 20231101.az', sourceLicense: 'Wikipedia: CC BY-SA 3.0 / GFDL; reviewed batch: user-authorized project use',
  attribution: 'Azerbaijani Wikipedia contributors; see data/nlp/SOURCES.md and article URLs in the source corpus. Reviewed targets are assistant-authored and owner-approved, not independently certified real-error gold.',
  datasetManifestSHA256: checksum(manifestText),
  ...(manifest.reviewManifestSHA256 ? { reviewManifestSHA256: manifest.reviewManifestSHA256, sourceManifestSHA256: manifest.sourceManifestSHA256 } : {}),
  originalLexiconSHA256: original.artifact.lexiconSha256,
  compaction: 'Unused observed edits/split tables removed; vocabulary restricted to the unchanged bounded 4..24 AZ-letter contract. Context counts retained.', verificationRows: count } };
mkdirSync(dirname(resolve(output)), { recursive: true });
const serialized = JSON.stringify(bundle) + '\n'; atomicWriteSync(output, serialized);
console.log({ bytes: Buffer.byteLength(serialized), verificationRows: count, identical: true });
