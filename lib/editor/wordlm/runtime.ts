import artifact from './model.json';
import { dictionaryCandidates } from '../dictionary';
import { BrowserWordLM } from './core';
import { wordLMTokens } from './core';
import { literalPattern } from '../literal-spans';
import { editStructuredText } from '../structured-text';
import { editHTMLStructure } from '../html-structure';
import contextInfo from './context-info.json';

export interface WordLMDecisions { rankedTokens: number; candidatesScored: number; changedTokens: number; contextualTokens: number }
export const initialWordLMDecisions = (): WordLMDecisions => ({ rankedTokens: 0, candidatesScored: 0, changedTokens: 0, contextualTokens: 0 });
export interface WordLMStats extends WordLMDecisions {
  mode: 'automatic'; loaded: true; sourceModelSHA256: string;
  vocabularyWords: number; vocabularySymbols: number; bigrams: number; trigrams: number;
  scoredTokens: number; knownTokens: number; logLikelihood: number;
  sourceContextArtifactSHA256: string;
}

let model: BrowserWordLM | undefined;
const vocabularyWords = artifact.words.filter(word => !word.startsWith('<')).length;
/** Score the final editable prose on every application request. These language
 * probabilities describe model usage, not a correctness confidence. */
export function scoreWordLMDocument(text: string, decisions = initialWordLMDecisions()): WordLMStats {
  model ??= new BrowserWordLM(artifact);
  const stats: WordLMStats = { mode: 'automatic', loaded: true, sourceModelSHA256: artifact.sourceModelSHA256,
    vocabularyWords,
    vocabularySymbols: artifact.words.length, bigrams: artifact.bigrams.length, trigrams: artifact.trigrams.length,
    scoredTokens: 0, knownTokens: 0, logLikelihood: 0, sourceContextArtifactSHA256: contextInfo.artifactSHA256, ...decisions };
  const collect = (value: string): string => {
    const prose = value.replace(/!?\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)/gu, '\n').replace(literalPattern(), '\n');
    for (const sentence of prose.split(/[.!?;\n]/u)) {
      let left = model!.mapped('<s>'), previous = left;
      for (const word of wordLMTokens(sentence)) {
        const current = model!.mapped(word), probability = model!.probability(left, previous, current);
        stats.scoredTokens++; stats.knownTokens += Number(model!.hasWord(word));
        stats.logLikelihood += Math.log(Math.max(Number.MIN_VALUE, probability));
        left = previous; previous = current;
      }
    }
    return value;
  };
  const fragment = (value: string) => editHTMLStructure(value, collect) ?? collect(value);
  if (editStructuredText(text, fragment, true) === undefined && editHTMLStructure(text, collect) === undefined) collect(text);
  return stats;
}
export function rankWordLM(left: readonly string[], candidates: readonly string[], right: readonly string[],limit=8) {
  model ??= new BrowserWordLM(artifact);
  const values=[...new Set(candidates)].slice(0,Math.max(0,Math.min(20,limit))),rows=[];
  for(let at=0;at<values.length;at+=8)rows.push(...model.rank(left,values.slice(at,at+8),right));
  return rows.sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word,'az'));
}
export function wordLMTokenId(word: string): number | undefined {
  model ??= new BrowserWordLM(artifact);
  return !word.startsWith('<') && model.hasWord(word) ? model.mapped(word) : undefined;
}
/** An OOV class represents many surfaces. A single unseen spelling must not
 * receive the entire class mass when competing with a known surface. */
export function wordLMSurfacePenalty(word: string): number {
  model ??= new BrowserWordLM(artifact);
  return model.hasWord(word) ? 0 : Math.log(model.vocabularySize);
}
/** Caller preserves established words, entities, literal spans and prior rule decisions. */
export function chooseWordLMSpelling(word: string, left: readonly string[], right: readonly string[]): string | undefined {
  // Case, explicit accents and non-ASCII words are evidence of the author's intent.
  if (!/^[a-z]{3,24}$/.test(word)) return undefined;
  const candidates = [...(dictionaryCandidates(word) ?? [])];
  if (candidates.includes(word) || candidates.length < 2 || candidates.length > 8) return undefined;
  const ranked = rankWordLM(left, candidates, right);
  const [first, second] = ranked;
  // Fixed conservative engineering guard, not a fitted noisy-channel lambda.
  if (!first.evidence || !Number.isFinite(first.score) || !Number.isFinite(second.score)
    || first.score - second.score < Math.log(20)) return undefined;
  return first.word;
}
