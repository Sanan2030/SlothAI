/** Node CPU diagnostic; not a browser download, Worker startup or network benchmark. */
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync } from 'node:fs';
import { bootstrap, quantile, random } from './metrics';
import type { CorrectionRuntime } from '../../lib/editor/correct';
const policies: Record<string, CorrectionRuntime> = { default: {}, always: { modelPolicy: 'always' }, noLocal: { useLocalModel: false }, noAttention: { useAttention: false }, noBounded: { useBounded: false }, noObserved: { useObservedChannel: false }, noBoundary: { useNeuralBoundary: false }, rulesOnly: { useLocalModel: false, useAttention: false, useBounded: false, useObservedChannel: false, useNeuralBoundary: false } };
const folded = (text: string) => text.toLocaleLowerCase('az-AZ').replace(/[əçğıöşü]/gu, letter => ({ ə: 'e', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[letter]!);
function summary(samples: number[]) { return { trials: samples.length, medianMs: bootstrap(samples, values => quantile(values, .5)), p95Ms: bootstrap(samples, values => quantile(values, .95)) }; }
async function probe(policy: string, cold: boolean) {
  const runtime = policies[policy]; if (!runtime) throw new Error('Unknown runtime');
  const before = process.memoryUsage(), importStart = performance.now();
  const { correctText } = await import('../../lib/editor/correct');
  const importMs = performance.now() - importStart, afterImport = process.memoryUsage();
  const text = Array.from({ length: 200 }, (_, i) => ['bu', 'gun', 'yeni', 'layiheni', 'yoxladim', 've', 'senedleri', 'hazirladim'][i % 8]).join(' ');
  const firstStart = performance.now(); correctText(text, false, runtime); const firstMs = performance.now() - firstStart;
  if (cold) return { importMs, firstMs, importAndFirstMs: importMs + firstMs, heapDeltaBytes: afterImport.heapUsed - before.heapUsed, rssBytes: afterImport.rss };
  for (let i = 0; i < 10; i++) correctText(text, false, runtime);
  const vocabulary = JSON.parse(readFileSync('lib/editor/generated/az-words.json', 'utf8')) as string[];
  const unique = [...new Set(vocabulary.filter(word => /^[a-zəçğıöşü]{4,9}$/u.test(word)).map(folded))].filter(word => !new Set(text.split(' ')).has(word));
  const next = random(20261007);
  for (let at = unique.length - 1; at > 0; at--) { const other = Math.floor(next() * (at + 1)); [unique[at], unique[other]] = [unique[other], unique[at]]; }
  const trials = 15;
  if (unique.length < trials * 1100) throw new Error('Not enough unique unseen folded forms');
  let cursor = 0;
  const lengths: Record<string, unknown> = {};
  for (const length of [200, 900]) {
    const warmText = Array.from({ length }, (_, i) => text.split(' ')[i % 200]).join(' '); correctText(warmText, false, runtime);
    const warm: number[] = [], novel: number[] = [];
    for (let trial = 0; trial < trials; trial++) {
      let start = performance.now(); correctText(warmText, false, runtime); warm.push(performance.now() - start);
      // Every folded token is used once in this process. Model vocabulary/index preload remains unavoidable.
      const input = unique.slice(cursor, cursor + length).join(' '); cursor += length;
      start = performance.now(); correctText(input, false, runtime); novel.push(performance.now() - start);
    }
    lengths[length] = { warm: summary(warm), novel: summary(novel), novelMedianMsPerWord: bootstrap(novel.map(ms => ms / length), values => quantile(values, .5)), novelP95MsPerWord: bootstrap(novel.map(ms => ms / length), values => quantile(values, .95)) };
  }
  return { lengths, note: 'Novel probe is shuffled dictionary-derived ASCII word soup, not natural prose; no repeated folded tokens, but prebuilt vocabulary/morphology caches still exist. Warm corpus is repetitive. Separate process per policy prevents cross-policy cache pollution.' };
}
async function main() {
  const policy = process.argv.find(value => value.startsWith('--probe='))?.slice(8);
  if (policy) { console.log(JSON.stringify(await probe(policy, process.argv.includes('--cold')))); return; }
  const child = (args: string[]) => { const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/eval/latency.ts', ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); if (result.status !== 0) throw new Error(result.stderr || result.stdout); return JSON.parse(result.stdout) as Awaited<ReturnType<typeof probe>>; };
  const cold = Array.from({ length: 10 }, () => child(['--probe=default', '--cold'])) as { importMs: number; firstMs: number; importAndFirstMs: number; heapDeltaBytes: number; rssBytes: number }[];
  const coldSummary = Object.fromEntries(['importMs', 'firstMs', 'importAndFirstMs', 'heapDeltaBytes', 'rssBytes'].map(key => [key, bootstrap(cold.map(row => row[key as keyof typeof row]), values => quantile(values, .5))]));
  const selected = process.argv.find(value => value.startsWith('--policy='))?.slice(9);
  if (selected && !policies[selected]) throw new Error('Unknown selected policy');
  const output = process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? 'docs/evaluation/phase0/latency.json';
  const results: Record<string, unknown> = {};
  for (const name of selected ? [selected] : Object.keys(policies)) { console.error(`latency: ${name}`); results[name] = child([`--probe=${name}`]); }
  writeFileSync(output, JSON.stringify({ environment: { node: process.version, platform: process.platform, arch: process.arch }, bootstrap: { repetitions: 1000, seed: 20261007, unit: 'fresh process (cold), trial/document (warm/novel)', confidence: .95 }, cold: coldSummary, coldTrials: cold.length, policies: results, measurementScope: 'Node process TS imports and synchronous correction, not real browser/Worker startup or downloaded asset timings.' }, null, 2) + '\n');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
