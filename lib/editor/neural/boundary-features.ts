/** Versioned, local character + grammatical features for sentence gaps. */
import { tokenize, fold, type Token } from '../local-ai/core';
import { artifactMorphology } from '../productive-morphology';
import { isClausePredicate, continuesConverb } from '../segmentation';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { characterVector } from './attention';
import type { Network } from './network';

export const BOUNDARY_FEATURE_VERSION = 1;
export const BOUNDARY_INPUTS = 166;
export interface NeuralBoundaryArtifact {
  version: 1;
  featureVersion: 1;
  network: Network;
  threshold: number;
  trainingSHA256: string;
  validationSHA256: string;
  provenance: string;
}
const connectors = new Set('ki çünki amma ancaq lakin halbuki və ya yoxsa isə üçün ilə kimi olaraq deyə da də'.split(' '));
const questionWords = new Set('kim kimin kimə nə nəyi nəyə nəyin nədən necə niyə hansı neçə harada hara'.split(' '));
const pronouns = new Set('mən sən o biz siz onlar bu həmin'.split(' '));
const numerals = new Set('bir iki üç dörd beş altı yeddi səkkiz doqquz on'.split(' '));
const reporters = new Set('bilirəm bilirik bilmirəm bilmirik bildim soruşdum öyrəndim'.split(' '));
const reportingLemmas = new Set('bil soruş öyrən anla açıqla de'.split(' '));
interface WordFeatures { surface: string; finite: boolean; converb: boolean; reporter: boolean; values: number[] }

function wordFeatures(word: string): WordFeatures {
  const lower = word.toLocaleLowerCase('az-AZ');
  const surface = artifactMorphology.findByFoldedForm(lower) ?? lower;
  const analyses = artifactMorphology.analyzeWord(surface);
  const hasPOS = (pos: string) => Number(analyses.some(row => row.pos === pos));
  const converb = /(?:ıb|ib|ub|üb)$/iu.test(surface)
    || analyses.some(row => row.features.mood === 'converb');
  const finite = !numerals.has(surface) && !isCanonicalEntity(surface)
    && !canonicalProtectedTerm(surface) && isClausePredicate(surface);
  const values = [...characterVector(surface), hasPOS('noun'), hasPOS('verb'), hasPOS('adjective'),
    Number(pronouns.has(surface)), Number(analyses.some(row => row.features.case === 'genitive')),
    Number(analyses.some(row => ['accusative', 'dative'].includes(row.features.case ?? ''))),
    Number(analyses.some(row => row.features.mood === 'participle')),
    Number(analyses.some(row => row.features.mood === 'conditional')),
    Number(converb), Number(finite)];
  const reporter = reporters.has(surface) || analyses.some(row => row.pos === 'verb' && reportingLemmas.has(row.lemma));
  return { surface, finite, converb, reporter, values };
}

export interface BoundaryContext {
  text: string;
  tokens: Token[];
  words: WordFeatures[];
  reported: boolean[];
}
/** Morphology and character vectors are computed once per word, never per candidate. */
export function prepareBoundaryContext(text: string): BoundaryContext {
  const tokens = tokenize(text), cache = new Map<string, WordFeatures>();
  const words = tokens.map(token => {
    let features = cache.get(token.word);
    if (!features) { features = wordFeatures(token.word); cache.set(token.word, features); }
    return features;
  });
  let reported = false;
  const flags = words.map((word, at) => {
    if (!at || tokens[at - 1].sentence !== tokens[at].sentence) reported = false;
    if (/^(?:ki|əgər)$/u.test(word.surface)) reported = true;
    return reported;
  });
  return { text, tokens, words, reported: flags };
}

/** Only independent finite clauses with a second predicate are proposed. */
export function eligibleBoundary(context: BoundaryContext, at: number): boolean {
  const { text, tokens, words, reported } = context;
  const left = tokens[at], right = tokens[at + 1];
  if (!right || left.sentence !== right.sentence || !/^ +$/u.test(text.slice(left.end, right.start))
    || !words[at].finite || words[at].converb || reported[at] || connectors.has(words[at + 1].surface)
    || continuesConverb(left.word, right.word, tokens[at + 2]?.word ?? '')) return false;
  if (words[at].reporter && (questionWords.has(words[at + 1].surface)
    || words[at + 1].surface === 'o' && questionWords.has(words[at + 2]?.surface ?? ''))) return false;
  // A verbal adjective followed by its noun cannot prove a complete sentence.
  if (/(?:mış|miş|muş|müş|acaq|əcək)$/iu.test(words[at].surface)
    && artifactMorphology.analyzeWord(words[at + 1].surface).some(row => row.pos === 'noun')) return false;
  for (let index = at + 1; index < Math.min(tokens.length, at + 17); index++) {
    if (tokens[index].sentence !== left.sentence) break;
    if (words[index].finite && !words[index].converb) return true;
  }
  return false;
}

export function boundaryFeatures(context: BoundaryContext, at: number): number[] {
  const { tokens, words } = context, sentence = tokens[at].sentence;
  const values: number[] = [];
  for (let offset = -2; offset <= 3; offset++) {
    const token = tokens[at + offset];
    values.push(...(token && token.sentence === sentence ? words[at + offset].values : Array(26).fill(0)));
  }
  let following = 0, previous = 0, distance = 0;
  for (let index = at + 1; index < Math.min(tokens.length, at + 17); index++) {
    if (tokens[index].sentence !== sentence) break;
    if (words[index].finite && !words[index].converb) following++;
  }
  for (let index = at - 1; index >= Math.max(0, at - 12); index--) {
    if (tokens[index].sentence !== sentence) break;
    distance++;
    if (words[index].finite && !words[index].converb) previous++;
  }
  const left = words[at].surface, right = words[at + 1]?.surface ?? '';
  values.push(Number(words[at].finite), Math.min(3, following) / 3, Math.min(3, previous) / 3,
    distance / 12, Number(context.reported[at]), Number(connectors.has(right)), Number(pronouns.has(right)),
    Number(questionWords.has(right)), Number(/(?:mı|mi|mu|mü)$/u.test(left)),
    Number(fold(right) === 'xahis' || fold(right) === 'zehmet'));
  if (values.length !== BOUNDARY_INPUTS) throw new Error('Boundary feature version mismatch.');
  return values;
}
