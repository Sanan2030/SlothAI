/** Whole-strategy latency, including WordLM, CharSpell and PunctCase, on the standard seed. */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { getStrategyRegistry } from '../../lib/strategies/bootstrap';

const seed = ('men bu gun mektebe getdim sonra dostumla gorusdum sabah saat onda yigincagimiz var lutfen gecikmeyin '
  + 'cunki cox vacib movzular muzakire olunacaq API request backend terefde yoxlanilir melumatlar sistemde saxlanilir '
  + 'neticeler hazir olanda gondereceyik tesekkur edirik sorgunuz qebul olundu layihe davam edir').split(' ');
const output = process.argv.find(value => value.startsWith('--out='))?.slice(6);

function chunks(words: number): string[] {
  const document = Array.from({ length: words }, (_, index) => seed[index % seed.length] + ((index + 1) % 24 === 0 ? '.' : ''));
  const result: string[] = []; let current = '';
  for (const word of document) {
    if (current.length + word.length + 1 > 9000) { result.push(current); current = ''; }
    current += (current ? ' ' : '') + word;
  }
  if (current) result.push(current);
  return result;
}

async function main() {
  const strategy = getStrategyRegistry().get('text-corrector');
  await strategy.transform({ text: chunks(100)[0] });
  const results = [];
  for (const words of [20, 100, 500, 1000, 5000]) {
    const input = chunks(words), timings = [];
    let modelRequests = 0;
    for (let iteration = 0; iteration < 3; iteration++) {
      const start = performance.now();
      for (const text of input) {
        const result = await strategy.transform({ text });
        if (result.metadata.wordLM?.mode !== 'automatic' || !result.metadata.wordLM.loaded
          || result.metadata.punctCase?.mode !== 'automatic' || !result.metadata.punctCase.loaded
          || result.metadata.charSpell?.mode !== 'automatic' || !result.metadata.charSpell.loaded) {
          throw new Error('A model did not run automatically');
        }
        modelRequests++;
      }
      timings.push(performance.now() - start);
    }
    const maximumMs = Math.max(...timings);
    results.push({ words, chunksPerDocument: input.length, iterations: 3, modelRequests,
      timingsMs: timings, maximumMs, ceilingMs: 10000, passed: maximumMs <= 10000 });
  }
  const report = { scope: 'Warm Node whole-strategy latency on this CPU, three repetitions per size; not mobile/browser latency.',
    concurrentWork: 'CharSpell training completed; other local QA may share this cloud CPU.', results };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
