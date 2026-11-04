/** Measured opt-in application cost on a bounded 1,000-word request. */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
import info from '../lib/editor/punctcase/model-info.json';

async function main() {
  const text = Array.from({ length: 143 }, () => 'qeyd edək ki bu məsələ hələ araşdırılır'.split(' ')).flat().slice(0, 1000).join(' ');
  const strategy = getStrategyRegistry().get('text-corrector');
  const started = performance.now();
  const cold = await strategy.transform({ text, options: { usePunctCase: true, preserveFormatting: true } });
  const coldMs = performance.now() - started;
  await strategy.transform({ text, options: { preserveFormatting: true } });
  const times: Record<string, number[]> = { baseline: [], punctCase: [] };
  for (let iteration = 0; iteration < 6; iteration++) {
    for (const mode of iteration % 2 ? ['punctCase', 'baseline'] : ['baseline', 'punctCase']) {
      const begin = performance.now();
      await strategy.transform({ text, options: { preserveFormatting: true, ...(mode === 'punctCase' ? { usePunctCase: true } : {}) } });
      times[mode].push(performance.now() - begin);
    }
  }
  const summarize = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return { runs: values.length, p50Ms: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
      meanMs: values.reduce((a, b) => a + b, 0) / values.length };
  };
  const report = { node: process.version, words: 1000, characters: text.length, coldOptInMs: coldMs,
    baseline: summarize(times.baseline), punctCase: summarize(times.punctCase),
    appliedEdits: cold.metadata.punctCase?.applied, headInferenceMs: cold.metadata.punctCase?.inferenceTimeMs,
    maxRSSKiB: process.resourceUsage().maxRSS, sourceCheckpointSHA256: info.sourceCheckpointSHA256,
    budgetMs: 2000, scope: 'Warm Node on this cloud CPU; explicit formatting preservation, alternating runs, no concurrent heavy checks. Not a mobile/browser latency guarantee.' };
  writeFileSync('docs/training/punctcase-latency-2026-11-04.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.punctCase.p95Ms > report.budgetMs || !report.appliedEdits) process.exitCode = 1;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
