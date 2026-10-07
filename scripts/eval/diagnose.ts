import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { tokenize } from '../../lib/editor/local-ai/core';
import { boundedCorrection } from '../../lib/editor/neural/bounded-runtime';
import { attentionCorrection } from '../../lib/editor/neural/attention-runtime';
import { boundedCandidates } from '../../lib/editor/neural/bounded-candidates';
import { transpositionIndex } from '../../lib/editor/neural/attention';
import { parameterCount, predictNetwork, type Network } from '../../lib/editor/neural/network';
import type { BoundedBundle } from '../../lib/editor/neural/bounded-head';
import { correctText } from '../../lib/editor/correct';
import { bootstrap, quantile } from './metrics';
const raw = ['hazirlanmasinda', 'hemkarlarimla', 'kecirdik', 'toplantiya', 'mudirle', 'Mekteblilere', 'toplashmishdi', 'hayata', 'menbeyini', 'konullusu', 'sertlerini', 'cavablandirdi', 'alindighini', 'duzdu', 'refe'];
const expected = ['hazırlanmasında', 'həmkarlarımla', 'keçirdik', 'toplantıya', 'müdirlə', 'Məktəblilərə', 'toplaşmışdı', 'həyata', 'mənbəyini', 'könüllüsü', 'şərtlərini', 'cavablandırdı', 'alındığını', 'düzdü', 'rəfə'];
const words = raw.map((word, at) => { const tokens = tokenize(`Biz ${word} sözünü yoxladıq.`); return { input: word, expected: expected[at], bounded: boundedCorrection(word, tokens, 1) ?? word, attention: attentionCorrection(word, tokens, 1) ?? word }; });
const bundle = JSON.parse(readFileSync('lib/editor/neural/bounded-model.json', 'utf8')) as BoundedBundle;
const candidateTimes: number[] = [], forwardTimes: number[] = [];
for (let repeat = 0; repeat < 15; repeat++) {
  // Fresh candidate-index identity clears only boundedCandidates' index-specific cache.
  const index = transpositionIndex(bundle.lexicon), start = performance.now();
  for (const word of raw) boundedCandidates(bundle.lexicon, index, word);
  candidateTimes.push((performance.now() - start) / raw.length);
  const x = Array(bundle.artifact.network.ranker.inputs).fill(.5), forwardStart = performance.now();
  for (let at = 0; at < 10000; at++) predictNetwork(bundle.artifact.network.ranker, x);
  forwardTimes.push((performance.now() - forwardStart) / 10000);
}
const neuralFiles = readdirSync('lib/editor/neural').filter(name => name.endsWith('.json'));
const inventory = neuralFiles.map(name => {
  const data = JSON.parse(readFileSync(`lib/editor/neural/${name}`, 'utf8'));
  const networks: { path: string; inputs: number; hidden: number; parameters: number; epochs: number }[] = [];
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.w1) && Array.isArray(object.w2) && typeof object.inputs === 'number') { const model = object as unknown as Network; networks.push({ path, inputs: model.inputs, hidden: model.hidden, parameters: parameterCount(model), epochs: model.epochs }); return; }
    for (const [key, child] of Object.entries(object)) walk(child, path ? `${path}.${key}` : key);
  };
  walk(data, '');
  return { name, bytes: readFileSync(`lib/editor/neural/${name}`).length, networks, attentionParameters: (data.network?.query?.length ?? data.artifact?.network?.query?.length ?? 0) + (data.network?.bias?.length ?? data.artifact?.network?.bias?.length ?? 0) };
});
const allJson = (readdirSync('lib/editor', { recursive: true }) as string[]).filter(name => name.endsWith('.json')).map(name => readFileSync(`lib/editor/${name}`));
const examples = ['Sərgi sabah açılacaq.', 'Sərginin qapısı açıqdır.', 'Əla nəticə əldə etmək üçün hər gün mütəmadi çalışmaq lazımdır.', 'ela netice elde etmek ucun her gun mutemadi calismaq lazimdir'];
writeFileSync('docs/evaluation/phase0/diagnostics.json', JSON.stringify({ suppliedWordList: { actualCount: words.length, note: 'Attachment says 20 but explicitly lists only 15; the five omitted cases and 73-sentence corpus are unavailable. Neutral mention context is not representative grammatical context.', words, boundedExact: bootstrap(words.map(row => Number(row.bounded === row.expected)), values => values.reduce((a, b) => a + b, 0) / values.length), attentionExact: bootstrap(words.map(row => Number(row.attention === row.expected)), values => values.reduce((a, b) => a + b, 0) / values.length) }, microbench: { candidateMedianMsPerWord: bootstrap(candidateTimes, values => quantile(values, .5)), mlpMedianMsPerForward: bootstrap(forwardTimes, values => quantile(values, .5)), note: 'Node 15 blocks. Candidate index construction excluded; index cache is fresh, global dictionary/morphology caches and JIT may be warm. 10000 repeated ranker forwards/block, 15 named candidate queries/block. Not an end-to-end causal profile.' }, inventory, size: { allEditorJsonBytes: allJson.reduce((n, bytes) => n + bytes.length, 0), concatenatedGzipBytes: gzipSync(Buffer.concat(allJson)).length, growthRuntimeJsonKiB: 0, note: 'Source JSON bytes include generated dictionary. Concatenated gzip is not the real Next bundle or asset download size. Counts are exact bookkeeping, not sampled metrics.' }, reproducedExamples: examples.map(input => ({ input, output: correctText(input).text })) }, null, 2) + '\n');
