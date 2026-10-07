import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export interface DatasetCase { id: string; documentId: string; domain: string; category: string; input: string; expected: string; probeWord?: string }
export interface Dataset { schemaVersion: number; purpose: string; provenance: string; trainingAllowed: boolean; cases: DatasetCase[] }
export const directory = 'data/evaluation/phase0';
export function dataset(name: string): Dataset {
  const bytes = readFileSync(`${directory}/${name}.json`), expected = readFileSync(`${directory}/${name}.sha256`, 'utf8').split(/\s/)[0];
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`${name}: frozen SHA-256 mismatch`);
  const data = JSON.parse(bytes.toString('utf8')) as Dataset;
  if (data.schemaVersion !== 1 || data.trainingAllowed !== false || !data.cases?.length) throw new Error(`${name}: invalid evaluation manifest`);
  for (const row of data.cases) if (![row.id, row.documentId, row.domain, row.category, row.input, row.expected].every(value => typeof value === 'string' && value.length > 0)) throw new Error(`${name}: invalid row`);
  return data;
}
