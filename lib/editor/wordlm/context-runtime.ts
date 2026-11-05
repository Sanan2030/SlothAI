import data from './context-model.json';
import { SpellingContextModel, type SourceContextArtifact } from './context';
import { wordLMTokenId } from './runtime';
import { foldLetters } from '../dictionary';
import { normalizeDigraphs } from '../local-ai/paired';
let model: SpellingContextModel | undefined;
const folded = (word: string) => foldLetters(normalizeDigraphs(word));
export function spellingContextAdjustments(raw: string, left: readonly string[], right: readonly string[], candidates: readonly {word:string;logScore:number}[]) {
  model ??= new SpellingContextModel(data as unknown as SourceContextArtifact, wordLMTokenId, folded);
  return model.adjustments(folded(raw), left, right, candidates);
}
