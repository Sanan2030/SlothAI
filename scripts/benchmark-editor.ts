import { performance } from 'node:perf_hooks';

import { correctText, MAX_TEXT_LENGTH } from '../lib/editor/correct';
import { buildAnimatedDiff } from '../lib/ui/text-diff';

type BenchmarkCase = {
  words: number;
  targetMs: number;
  iterations: number;
};

type BenchmarkResult = {
  words: number;
  requests: number;
  chars: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  targetMs: number;
  rssBaseMb: number;
  rssPeakMb: number;
  rssDeltaMb: number;
  heapDeltaMb: number;
  status: 'PASS' | 'FAIL';
};

const CASES: BenchmarkCase[] = [
  { words: 20, targetMs: 50, iterations: 12 },
  { words: 100, targetMs: 100, iterations: 10 },
  { words: 500, targetMs: 300, iterations: 8 },
  { words: 1_000, targetMs: 600, iterations: 7 },
  { words: 5_000, targetMs: 2_500, iterations: 5 },
];

const SEED = [
  'men', 'bu', 'gun', 'mektebe', 'getdim', 'sonra', 'dostumla', 'gorusdum',
  'sabah', 'saat', 'onda', 'yigincagimiz', 'var', 'lutfen', 'gecikmeyin',
  'cunki', 'cox', 'vacib', 'movzular', 'muzakire', 'olunacaq', 'API',
  'request', 'backend', 'terefde', 'yoxlanilir', 'melumatlar', 'sistemde',
  'saxlanilir', 'neticeler', 'hazir', 'olanda', 'gondereceyik', 'tesekkur',
  'edirik', 'sorgunuz', 'qebul', 'olundu', 'layihe', 'davam', 'edir',
];

const MAX_CHUNK_CHARS = Math.min(9_000, MAX_TEXT_LENGTH - 500);
const enforce = process.argv.includes('--enforce');
const jsonOnly = process.argv.includes('--json');

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mb(bytes: number): number {
  return round(bytes / 1024 / 1024);
}

function gc(): void {
  const runtime = globalThis as typeof globalThis & { gc?: () => void };
  runtime.gc?.();
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index];
}

function buildDocument(wordCount: number): string {
  const words = Array.from({ length: wordCount }, (_, index) => {
    const word = SEED[index % SEED.length];
    return (index + 1) % 24 === 0 ? word + '.' : word;
  });
  return words.join(' ');
}

function chunkDocument(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const words = text.split(/\s+/u);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function executeDocument(chunks: string[]): { elapsedMs: number; peakRss: number; peakHeap: number } {
  const start = performance.now();
  let peakRss = process.memoryUsage().rss;
  let peakHeap = process.memoryUsage().heapUsed;

  for (const chunk of chunks) {
    correctText(chunk);
    const memory = process.memoryUsage();
    peakRss = Math.max(peakRss, memory.rss);
    peakHeap = Math.max(peakHeap, memory.heapUsed);
  }

  return {
    elapsedMs: performance.now() - start,
    peakRss,
    peakHeap,
  };
}

function benchmarkCase(config: BenchmarkCase): BenchmarkResult {
  const document = buildDocument(config.words);
  const chunks = chunkDocument(document);
  const timings: number[] = [];
  let observedPeakRss = 0;
  let observedPeakHeap = 0;
  let lowestBaseRss = Number.POSITIVE_INFINITY;
  let lowestBaseHeap = Number.POSITIVE_INFINITY;

  for (let iteration = 0; iteration < config.iterations; iteration++) {
    gc();
    const before = process.memoryUsage();
    lowestBaseRss = Math.min(lowestBaseRss, before.rss);
    lowestBaseHeap = Math.min(lowestBaseHeap, before.heapUsed);

    const run = executeDocument(chunks);
    timings.push(run.elapsedMs);
    observedPeakRss = Math.max(observedPeakRss, run.peakRss);
    observedPeakHeap = Math.max(observedPeakHeap, run.peakHeap);
  }

  timings.sort((a, b) => a - b);
  const avg = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  const p50 = percentile(timings, 0.5);
  const p95 = percentile(timings, 0.95);

  return {
    words: config.words,
    requests: chunks.length,
    chars: document.length,
    avgMs: round(avg),
    p50Ms: round(p50),
    p95Ms: round(p95),
    minMs: round(timings[0]),
    maxMs: round(timings[timings.length - 1]),
    targetMs: config.targetMs,
    rssBaseMb: mb(lowestBaseRss),
    rssPeakMb: mb(observedPeakRss),
    rssDeltaMb: mb(Math.max(0, observedPeakRss - lowestBaseRss)),
    heapDeltaMb: mb(Math.max(0, observedPeakHeap - lowestBaseHeap)),
    status: p95 <= config.targetMs ? 'PASS' : 'FAIL',
  };
}

// Warm the module, dictionary indexes and JIT before collecting measurements.
const warmup = chunkDocument(buildDocument(100));
for (let i = 0; i < 5; i++) executeDocument(warmup);

const results = CASES.map(benchmarkCase);
const failed = results.filter((result) => result.status === 'FAIL');
const diffResults = CASES.map(config => {
  const input = buildDocument(config.words);
  const chunks = chunkDocument(input);
  const output = chunks.map(chunk => correctText(chunk).text).join(' ');
  const timings: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < config.iterations; i++) {
    const start = performance.now();
    buildAnimatedDiff(input, output);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const p95Ms = round(percentile(timings, 0.95));
  return { words: config.words, requests: chunks.length, chars: input.length,
    scope: chunks.length > 1 ? 'logical multi-chunk document' : 'single request',
    avgMs: round(timings.reduce((sum, t) => sum + t, 0) / timings.length),
    p50Ms: round(percentile(timings, 0.5)), p95Ms, targetMs: config.targetMs,
    heapDeltaMb: mb(Math.max(0, process.memoryUsage().heapUsed - heapBefore)),
    status: p95Ms <= config.targetMs ? 'PASS' : 'FAIL' };
});

if (jsonOnly) {
  console.log(JSON.stringify({
    node: process.version,
    maxInputChars: MAX_TEXT_LENGTH,
    maxBenchmarkChunkChars: MAX_CHUNK_CHARS,
    results,
    diffResults,
  }, null, 2));
} else {
  console.log('\nSlothAI editor benchmark');
  console.log(`Node: ${process.version} | engine input limit: ${MAX_TEXT_LENGTH} chars | benchmark chunk: ${MAX_CHUNK_CHARS} chars`);
  console.log('5000-word case is measured as a logical document split into production-safe chunks when required.\n');

  console.table(results.map((result) => ({
    words: result.words,
    requests: result.requests,
    chars: result.chars,
    avg_ms: result.avgMs,
    p50_ms: result.p50Ms,
    p95_ms: result.p95Ms,
    target_ms: result.targetMs,
    rss_base_mb: result.rssBaseMb,
    rss_peak_mb: result.rssPeakMb,
    rss_delta_mb: result.rssDeltaMb,
    heap_delta_mb: result.heapDeltaMb,
    status: result.status,
  })));

  console.log('\nNotes:');
  console.log('UI diff (separate from engine latency):');
  console.table(diffResults);
  console.log('- Latency gate uses p95 warm latency.');
  console.log('- RSS/heap values are process-level approximate measurements, useful for before/after regressions.');
  console.log('- Use the same Node version and machine when comparing commits.');
  console.log('- Run with --json for machine-readable output.');
}

if (enforce && (failed.length || diffResults.some(result => result.status === 'FAIL'))) {
  console.error(`\nPerformance gate failed for: ${failed.map((result) => result.words + ' words').join(', ')}`);
  process.exitCode = 1;
}
