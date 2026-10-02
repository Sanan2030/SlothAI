import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksum, type Split } from './data';
export interface Manifest {
  version: 2; partitions: Record<Split, { sha256: string; rows: number }>;
  documents: { documentId: string; split: Split; cluster: string }[];
}
export function verifyManifest(directory: string): Manifest {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.version !== 2 || !manifest.partitions || !Array.isArray(manifest.documents)) throw new Error('Rebuild with nlp:data: version 2 integrity manifest required.');
  const owners = new Map<string, Split>(), clusters = new Map<string, Split>();
  for (const doc of manifest.documents) {
    if (!doc.documentId || !doc.cluster || !['train', 'validation', 'test'].includes(doc.split)) throw new Error('Invalid document manifest.');
    if (owners.has(doc.documentId)) throw new Error('Duplicate manifest document.'); owners.set(doc.documentId, doc.split);
    if (clusters.has(doc.cluster) && clusters.get(doc.cluster) !== doc.split) throw new Error('Near-duplicate cluster crosses splits.'); clusters.set(doc.cluster, doc.split);
  }
  for (const split of ['train', 'validation', 'test'] as const) {
    const raw = readFileSync(resolve(directory, split + '.jsonl'), 'utf8'), partition = manifest.partitions[split];
    if (!partition || checksum(raw) !== partition.sha256) throw new Error('Dataset content checksum mismatch: ' + split);
    const rows = raw.split(/\r?\n/u).filter(line => line.trim());
    if (rows.length !== partition.rows) throw new Error('Dataset row count mismatch.');
    for (const line of rows) {
      const row = JSON.parse(line) as { documentId: string; split: string };
      if (row.split !== split || owners.get(row.documentId) !== split) throw new Error('Row document assignment does not match the split manifest.');
    }
  }
  return manifest;
}
