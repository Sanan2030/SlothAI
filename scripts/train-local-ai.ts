import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { trainContextModel, fold, tokenize, predictContext } from '../lib/editor/local-ai/core';
import { expandContextModel, type TrainingExpansion } from '../lib/editor/local-ai/expand';

const seeds = readFileSync('data/local-ai/seeds.txt', 'utf8').trim().split('\n');
if (seeds.length < 100 || new Set(seeds).size !== seeds.length) throw new Error('Expected at least 100 unique authored gold texts.');
// Keep the original training membership stable; validation uses only newly authored groups.
const splitFor = (index: number) => index % 5 === 4 ? 'test' : index >= 100 && index % 5 === 3 ? 'validation' : 'train';
function corrupt(text: string, variant: number): string {
  const ascii = fold(text);
  if (variant === 0) return ascii.replace(/[.,!?]/gu, '');
  if (variant === 1) return ascii;
  if (variant === 2) return text.toLocaleLowerCase('az-AZ').replace(/[.,!?]/gu, '');
  if (variant === 3) return ascii.replace(/s/g, 'sh').replace(/c/g, 'ch').replace(/[.,!?]/gu, '');
  const tokens = tokenize(ascii);
  const candidate = tokens.find((token, index) => index > 0 && token.word.length >= 6);
  if (!candidate) throw new Error('Seed has no typo candidate.');
  const position = candidate.start + 2;
  return ascii.slice(0, position) + ascii.slice(position + 1);
}
const pairs = seeds.flatMap((target, index) => Array.from({ length: 5 }, (_, variant) => ({
  id: `local-${String(index + 1).padStart(3, '0')}-${variant + 1}`,
  groupId: `gold-${index + 1}`, split: splitFor(index),
  origin: 'authored-gold-with-synthetic-corruption', variant,
  input: corrupt(target, variant), target,
})));
if (new Set(pairs.map(pair => pair.input)).size !== pairs.length) throw new Error('Pairs are not unique.');
const training = seeds.filter((_, index) => splitFor(index) === 'train');
const supplemental = readFileSync('data/local-ai/supplemental-training.txt', 'utf8').trim().split('\n');
if (new Set(supplemental).size !== supplemental.length || supplemental.some(text => seeds.includes(text))) throw new Error('Supplemental texts must be unique and disjoint from all split groups.');
const expansion = JSON.parse(readFileSync('data/local-ai/expansion.json', 'utf8')) as TrainingExpansion;
const model = expandContextModel(trainContextModel([...training, ...supplemental]), expansion);
mkdirSync('data/local-ai', { recursive: true });
mkdirSync('lib/editor/local-ai', { recursive: true });
writeFileSync('data/local-ai/pairs.json', JSON.stringify({ version: 1, pairs }, null, 2) + '\n');
writeFileSync('lib/editor/local-ai/model.json', JSON.stringify(model, null, 2) + '\n');
let eligible = 0, accepted = 0, correct = 0, wrong = 0;
for (const pair of pairs.filter(item => item.split === 'test')) {
  // Diacritic/punctuation corruption preserves token alignment. Transliteration
  // and typo cases are reported separately by the end-to-end evaluation.
  if (pair.variant > 2) continue;
  const input = tokenize(pair.input), target = tokenize(pair.target);
  input.forEach((token, index) => {
    if (!model.groups[fold(token.word)] || /[əıçğöşü]/iu.test(token.word)) return;
    eligible++;
    const prediction = predictContext(model, token.word, input, index);
    if (!prediction?.accepted) return;
    accepted++;
    if (prediction.word === target[index].word.toLocaleLowerCase('az-AZ')) correct++; else wrong++;
  });
}
const report = { algorithm: model.algorithm, pairCount: pairs.length,
  trainPairs: pairs.filter(pair => pair.split === 'train').length,
  validationPairs: pairs.filter(pair => pair.split === 'validation').length,
  testPairs: pairs.filter(pair => pair.split === 'test').length,
  independentGoldGroups: { train: training.length, validation: seeds.filter((_, index) => splitFor(index) === 'validation').length, test: seeds.filter((_, index) => splitFor(index) === 'test').length }, splitPolicy: 'all variants of a gold text stay in one split',
  source: `${seeds.length} author-written gold texts; five synthetic variants each; no scraped or user data`,
  corpusSha256: createHash('sha256').update(JSON.stringify(pairs)).digest('hex'),
  supplementalTrainingTexts: supplemental.length,
  expansionWordForms: expansion.forms.length,
  expansionBoundaryPatterns: expansion.boundaries.length,
  expansionTrainingTexts: [...expansion.forms, ...expansion.boundaries].flatMap(item => item.texts).length,
  learnedWordForms: Object.keys(model.forms).length,
  learnedBoundaryPatterns: Object.keys(model.boundaries).length,
  modelBytes: Buffer.byteLength(JSON.stringify(model)), candidateGroups: Object.keys(model.groups),
  heldOutAmbiguityDecisions: { eligible, accepted, correct, wrong, abstained: eligible - accepted },
  limitations: 'This measures a small synthetic corpus; it is not general Azerbaijani accuracy or human semantic understanding.' };
writeFileSync('data/local-ai/training-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
