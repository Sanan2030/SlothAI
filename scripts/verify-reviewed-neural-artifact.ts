import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyManifest } from './nlp/manifest';
import { checksum } from './nlp/data';
import type { ExperimentBundle } from './nlp/inference';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const data = option('data'), model = option('model');
if (!data || !model) throw new Error('Use --data=merged-splits --model=bounded-model.json');
verifyManifest(data);
const manifestText = readFileSync(resolve(data, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText) as { reviewManifestSHA256: string; sourceManifestSHA256: string };
const bundle = JSON.parse(readFileSync(model, 'utf8')) as ExperimentBundle & {
  provenance: { datasetManifestSHA256: string; reviewManifestSHA256: string; sourceManifestSHA256: string };
};
if (bundle.artifact.lexiconSha256 !== checksum(JSON.stringify(bundle.lexicon))) throw new Error('Artifact lexicon hash mismatch.');
if (bundle.provenance.datasetManifestSHA256 !== checksum(manifestText)
  || bundle.provenance.reviewManifestSHA256 !== manifest.reviewManifestSHA256
  || bundle.provenance.sourceManifestSHA256 !== manifest.sourceManifestSHA256) {
  throw new Error('Artifact training data provenance does not match the rebuilt frozen dataset.');
}
if (bundle.artifact.candidateMode !== 'bounded-edits' || bundle.artifact.featureVersion !== 1
  || bundle.artifact.network.ranker.inputs !== 71 || bundle.artifact.threshold < 0.99995) {
  throw new Error('Unsupported reviewed neural release contract.');
}
console.log({ verified: true, epochs: bundle.artifact.network.epochs, datasetManifestSHA256: checksum(manifestText) });
