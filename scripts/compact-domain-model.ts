import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tokenize } from '../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import type { ExperimentBundle } from './nlp/inference';
import { parseDomainCorpus } from './nlp/domain-data';
import { checksum } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = option('model'), output = option('output'), data = option('data');
if (!model || !output || !data) throw new Error('Use --model=trained.json --output=compact.json --data=domain-splits');
verifyManifest(data);
const source = readFileSync('data/nlp/domain/az-domain-001.json', 'utf8');
const vocabulary = new Set(parseDomainCorpus(source).filter(row => row.split === 'train').flatMap(row => tokenize(row.target).map(token => token.word.toLocaleLowerCase('az-AZ'))).filter(word => /^[a-zəçğıöşü]{4,24}$/u.test(word) && !canonicalProtectedTerm(word)));
const bundle = JSON.parse(readFileSync(model, 'utf8')) as ExperimentBundle;
const originalLexiconSHA256 = checksum(JSON.stringify(bundle.lexicon));
if (bundle.artifact.lexiconSha256 !== originalLexiconSHA256) throw new Error('Lexicon checksum mismatch.');
bundle.lexicon.words = Object.fromEntries(Object.entries(bundle.lexicon.words).filter(([word]) => vocabulary.has(word)));
bundle.lexicon.edits = {}; bundle.lexicon.splits = {};
bundle.artifact.lexiconSha256 = checksum(JSON.stringify(bundle.lexicon));
bundle.artifact.threshold = Math.max(0.99995, bundle.artifact.threshold);
const provenance = { domainCorpusSHA256: checksum(source), datasetManifestSHA256: checksum(readFileSync(resolve(data, 'manifest.json'), 'utf8')), originalLexiconSHA256,
  policy: 'Vocabulary from 80 domain training targets only. Restriction changes candidate competition; requires subsequent complete-editor validation. No test targets used.',
  sources: 'Wikipedia CC BY-SA/GFDL, approved review batch, explicitly delegated synthetic domain references; see SOURCES.md', words: Object.keys(bundle.lexicon.words).length };
mkdirSync(dirname(output), { recursive: true });
const serialized = JSON.stringify({ ...bundle, provenance }) + '\n'; atomicWriteSync(output, serialized);
console.log({ words: provenance.words, bytes: Buffer.byteLength(serialized) });
