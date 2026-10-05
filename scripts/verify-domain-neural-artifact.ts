import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksum } from './nlp/data';
import { verifyManifest } from './nlp/manifest';
import { parseDomainCorpus } from './nlp/domain-data';
import { tokenize } from '../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import { createDomainHead, type BoundedBundle } from '../lib/editor/neural/bounded-head';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const data = option('data'), model = option('model');
if (!data || !model) throw new Error('Use --data=domain-splits --model=domain-model.json');
verifyManifest(data);
const corpus = readFileSync('data/nlp/domain/az-domain-001.json', 'utf8');
const manifest = readFileSync(resolve(data, 'manifest.json'), 'utf8');
const bundle = JSON.parse(readFileSync(model, 'utf8')) as BoundedBundle & { provenance: { domainCorpusSHA256: string; datasetManifestSHA256: string; words: number } };
if (bundle.artifact.lexiconSha256 !== checksum(JSON.stringify(bundle.lexicon)) || bundle.provenance.domainCorpusSHA256 !== checksum(corpus)
  || bundle.provenance.datasetManifestSHA256 !== checksum(manifest)) throw new Error('Domain artifact/data checksum mismatch.');
const allowed = new Set(parseDomainCorpus(corpus).filter(row => row.split === 'train').flatMap(row => tokenize(row.target).map(token => token.word.toLocaleLowerCase('az-AZ'))).filter(word => /^[a-zəçğıöşü]{4,24}$/u.test(word) && !canonicalProtectedTerm(word)));
const words = Object.keys(bundle.lexicon.words);
if (!words.length || words.length !== bundle.provenance.words || words.some(word => !allowed.has(word)) || Object.keys(bundle.lexicon.edits).length || Object.keys(bundle.lexicon.splits).length
  || bundle.artifact.threshold < 0.7) throw new Error('Domain vocabulary/threshold violates training-only contract.');
createDomainHead(bundle);
console.log({ verified: true, words: words.length, epochs: bundle.artifact.network.epochs });
