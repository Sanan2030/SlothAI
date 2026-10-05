import { createBoundedHead } from '../../lib/editor/neural/bounded-head';
import type { NeuralSpellingFallback } from '../../lib/editor/neural/runtime';
import type { PairedModel } from '../../lib/editor/local-ai/paired';
import { tokenize } from '../../lib/editor/local-ai/core';
import { rankAttention, transpositionIndex, type AttentionArtifact } from '../../lib/editor/neural/attention';
import { dictionaryCandidates } from '../../lib/editor/dictionary';
import { productiveMorphology } from '../../lib/editor/productive-morphology';
import { canonicalProtectedTerm } from '../../lib/editor/protected-terminology';
import { preservesDiacritics } from '../../lib/editor/neural/diacritics';
import { protectedMask } from './data';
export interface ExperimentBundle { artifact: AttentionArtifact; lexicon: PairedModel }
/** Offline experiment inference; production never loads these model files. */
export function createExperimentPredictor(bundle: ExperimentBundle) {
  const { artifact, lexicon } = bundle;
  if (artifact.version !== 1 || artifact.featureVersion !== 1 || artifact.network.ranker.inputs !== 71) throw new Error('Unsupported experiment artifact.');
  const index = transpositionIndex(lexicon);
  return (text: string, protectedTerms: readonly string[] = []) => {
    const mask = protectedMask(text, protectedTerms), tokens = tokenize(text); let output = '', cursor = 0;
    for (let at = 0; at < tokens.length; at++) {
      const token = tokens[at], raw = token.word, lower = raw.toLocaleLowerCase('az-AZ');
      if (mask.slice(token.start, token.end).some(Boolean) || canonicalProtectedTerm(raw)
        || Object.hasOwn(lexicon.words, lower) || dictionaryCandidates(lower)?.has(lower)
        || productiveMorphology.isValidWordForm(raw)) continue;
      const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
      if (!decision?.accepted || !preservesDiacritics(raw, decision.candidate)) continue;
      output += text.slice(cursor, token.start) + decision.candidate; cursor = token.end;
    }
    return output + text.slice(cursor);
  };
}

/** Inject a candidate head into the complete production pipeline for comparison. */
export function createExperimentFallback(bundle: ExperimentBundle, terms: readonly string[] = []): NeuralSpellingFallback {
  if (bundle.artifact.candidateMode === 'bounded-edits') return createBoundedHead(bundle, terms, 0.7);
  const { artifact, lexicon } = bundle, index = transpositionIndex(lexicon);
  return (raw, tokens, at) => {
    const lower = raw.toLocaleLowerCase('az-AZ');
    if (/\p{Lu}/u.test(raw) || canonicalProtectedTerm(raw) || terms.some(term => term.toLocaleLowerCase('az-AZ') === lower)) return undefined;
    const decision = rankAttention(artifact, lexicon, index, raw, tokens, at);
    return decision?.accepted && preservesDiacritics(raw, decision.candidate) ? decision.candidate : undefined;
  };
}
