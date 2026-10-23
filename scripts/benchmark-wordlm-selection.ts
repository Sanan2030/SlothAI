import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { correctText, type CorrectionRuntime } from '../lib/editor/correct';

const output = process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? '/tmp/slothai-wordlm-latency.json';
const seed = 'men bu gun mektebe getdim bu seher gozeldir sonra dostumla gorusdum'.split(' ');
const modes: Record<string, CorrectionRuntime> = { full: {}, experimental: { wordLMMode: 'experimental' } };
const rows = [];
for (const words of [100, 1000]) {
  const input = Array.from({ length: words }, (_, at) => seed[at % seed.length] + ((at + 1) % seed.length === 0 ? '.' : '')).join(' ');
  for (const options of Object.values(modes)) correctText(input, false, options);
  const timings: Record<string, number[]> = { full: [], experimental: [] };
  for (let repeat = 0; repeat < 5; repeat++) for (const [mode, options] of Object.entries(modes)) {
    const start = performance.now(); correctText(input, false, options); timings[mode].push(performance.now() - start);
  }
  for (const [mode, samples] of Object.entries(timings)) {
    const sorted = [...samples].sort((a, b) => a - b);
    rows.push({ words, chars: input.length, mode, iterations: samples.length, p50Ms: sorted[2], p95Ms: sorted[4] });
  }
}
const report = { scope: 'Warm local Node engine, repeated synthetic text, five alternating samples per mode; not browser or general workload latency.', node: process.version, rows };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
