import { isClosedFunctionForm } from '../function-word-forms';
import { boundedCorrection } from './bounded-runtime';
import { preservesDiacritics } from './diacritics';
export { preservesDiacritics } from './diacritics';
import { attentionCorrection, unresolvedAttentionAmbiguity } from './attention-runtime';
import { createNominalRepair } from './nominal-repair';
import { finiteAnalyses, agreementForms, areRegularCaseAlternatives } from './morphology';
import { isFinitePredicate } from '../segmentation';
import artifact from './model.json';
import pairedArtifact from '../local-ai/paired-model.json';
import { predictNetwork } from './network';
import { neuralIndex, neuralCandidates, lexicalFeatures, agreementFeatures, subjects, type Subject } from './features';
import type { NeuralArtifact } from './types';
import { tokenize, fold, type Token } from '../local-ai/core';
import { isReviewedSpelling, isEstablishedSurface } from '../lexicon';
import { dictionaryCandidates } from '../dictionary';
import { productiveMorphology } from '../productive-morphology';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
const model = artifact as NeuralArtifact, index = neuralIndex(model.lexicon);
const nominalRepair = createNominalRepair(model.lexicon);

function eligibleNeuralWord(raw: string): boolean {
  const lower = raw.toLocaleLowerCase('az-AZ');
  return !(!/^[\p{L}]{4,24}$/u.test(raw) || model.lexicon.words[lower] || Object.hasOwn(pairedArtifact.words, lower)
      || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)
      || canonicalProtectedTerm(raw) || isCanonicalEntity(raw)
      || isClosedFunctionForm(raw) || isReviewedSpelling(lower) || dictionaryCandidates(lower)?.has(lower) || productiveMorphology.isValidWordForm(raw)
      || [...(dictionaryCandidates(lower) ?? [])].some(word => preservesDiacritics(raw, word)
        && productiveMorphology.generateForms({ lemma: word, pos: 'verb', limit: 1 }).length > 0));
}

export function hasLearnedSpellingCandidate(raw: string): boolean {
  const lower = raw.toLocaleLowerCase('az-AZ');
  return eligibleNeuralWord(raw) && Object.hasOwn(model.lexicon.edits, lower);
}

/** This network repairs unknown surfaces. Established/explicit valid words win. */
export function neuralSpelling(text: string, useAttention = true): string {
  const tokens = tokenize(text); let result = '', cursor = 0;
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at], raw = token.word, lower = raw.toLocaleLowerCase('az-AZ');
    if (!eligibleNeuralWord(raw)) continue;
    // Known errors use frozen prior weights; new errors use the newly trained head.
    const lexicalNetwork = model.lexicalAnchor && Object.values(model.lexicon.edits[lower] ?? {}).some(count => count >= 3) ? model.lexicalAnchor : model.lexical;
    // Short forms often represent different valid verbs (itdi/etdi).
    // Require direct learned evidence before attempting their spelling.
    if (lower.length < 5 && !Object.hasOwn(model.lexicon.edits, lower)) continue;
    const choices = neuralCandidates(model.lexicon, index, raw).map(word => ({ word,
      score: predictNetwork(lexicalNetwork, lexicalFeatures(model.lexicon, raw, word, tokens, at)) }))
      .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
    const best = choices[0];
    let selected: string | undefined = nominalRepair(lower);
    if (!selected && best && best.score >= model.lexicalThreshold && best.score - (choices[1]?.score ?? 0) >= model.lexicalMargin) {
      const learned = model.lexicon.edits[lower]?.[best.word] ?? 0;
      const repeatedLetterRepair = [...lower].some((letter, i) => i > 0 && letter === lower[i - 1]
        && fold(lower.slice(0, i) + lower.slice(i + 1)) === fold(best.word));
      const safeLength = learned || lower.length === best.word.length || repeatedLetterRepair;
      const safeEnding = learned || !/(?:anda|əndə|arkən|ərkən|ınca|incə)$/u.test(lower);
      if (safeLength && safeEnding && fold(raw) !== fold(best.word) && preservesDiacritics(raw, best.word)) selected = best.word;
    }
    // A low neural score does not disprove a uniquely validated root/suffix
    // repair. Keep global model thresholds unchanged; validate this fallback
    // using morphology, trained error channels and explicit-letter protection.
    // The small learned character/context head only handles adjacent swaps
    // when all established correction paths have abstained.
    if (useAttention) selected ??= attentionCorrection(lower, tokens, at);
    // Unique reviewed paradigms restore ASCII diacritics outside model coverage.
    selected ??= productiveMorphology.findByFoldedForm(lower);
    if (!selected || !isEstablishedSurface(selected) || !preservesDiacritics(raw, selected) || areRegularCaseAlternatives(lower, selected)) continue;
    const target = /^\p{Lu}/u.test(raw) ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
    result += text.slice(cursor, token.start) + target; cursor = token.end;
  }
  return result + text.slice(cursor);
}
/** Explicit clause-initial personal subjects only; no inferred referents. */
export function neuralAgreement(text: string): string {
  const tokens = tokenize(text); let subject: Subject | undefined, subjectAt = -1, cursor = 0, result = '';
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at], word = token.word.toLocaleLowerCase('az-AZ');
    const gap = text.slice(at ? tokens[at - 1].end : 0, token.start);
    const clauseStart = at === 0 || /[.!?\n,;:]/u.test(gap) || /^(?:amma|ancaq|lakin|ki|çünki)$/iu.test(tokens[at - 1]?.word ?? '');
    if (clauseStart) subject = undefined;
    if (subjects[word] && !clauseStart) { subject = undefined; continue; }
    if (subjects[word] && clauseStart && !/[“«"'<>\uE000-\uF8FF]/u.test(gap)) { subject = subjects[word]; subjectAt = at; continue; }
    if (!subject || at - subjectAt > 8) continue;
    if (/^(?:və|ya|ki|çünki|amma|ancaq|lakin)$/iu.test(word)) { subject = undefined; continue; }
    const records = finiteAnalyses(word).filter(row => row.pos === 'verb' && ['present', 'past', 'future'].includes(row.features.tense ?? '') && !row.features.mood);
    if (!records.length) { if (isFinitePredicate(word)) subject = undefined; continue; }
    const meanings = new Set(records.map(row => row.lemma + ':' + row.features.tense + ':' + row.features.polarity + ':' + (row.features.derivation ?? []).join(',')));
    if (meanings.size !== 1 || productiveMorphology.analyzeWord(word).some(row => row.pos === 'noun')) { subject = undefined; continue; }
    const original = records[0];
    if (predictNetwork(model.agreement, agreementFeatures(subject, original.features)) >= model.agreementThreshold) { subject = undefined; continue; }
    const candidates = agreementForms({ lemma: original.lemma, pos: 'verb',
      features: { ...original.features, ...subject }, limit: 4 }).filter(candidate => {
      const rows = finiteAnalyses(candidate);
      return rows.some(row => row.lemma === original.lemma && row.features.tense === original.features.tense && !row.features.mood && JSON.stringify(row.features.derivation ?? []) === JSON.stringify(original.features.derivation ?? []) && predictNetwork(model.agreement, agreementFeatures(subject!, row.features)) >= model.agreementThreshold);
    });
    if (candidates.length === 1 && candidates[0] !== word) {
      result += text.slice(cursor, token.start) + candidates[0]; cursor = token.end;
    }
    subject = undefined; // Stop at the first finite predicate, not an arbitrary later verb.
  }
  return result + text.slice(cursor);
}

/** High-confidence learned swap corrections run after span/entity protection
 * and before dictionary guesses can destroy the original ambiguous surface. */
export type NeuralSpellingFallback = (raw: string, tokens: Token[], at: number) => string | undefined;
export function neuralTranspositions(text: string, protectUncertain?: (word: string) => string, fallback: NeuralSpellingFallback | null = boundedCorrection, inferWord?: (raw: string) => boolean): string {
  const tokens = tokenize(text); let result = '', cursor = 0;
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at], raw = token.word;
    if (inferWord && !inferWord(raw) || !eligibleNeuralWord(raw)) continue;
    if (protectUncertain && unresolvedAttentionAmbiguity(raw, tokens, at)) {
      result += text.slice(cursor, token.start) + protectUncertain(raw); cursor = token.end; continue;
    }
    const selected = attentionCorrection(raw, tokens, at) ?? fallback?.(raw, tokens, at);
    if (!selected || !isEstablishedSurface(selected) || !preservesDiacritics(raw, selected) || areRegularCaseAlternatives(raw, selected)) continue;
    const target = /^\p{Lu}/u.test(raw) ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
    result += text.slice(cursor, token.start) + target; cursor = token.end;
  }
  return result + text.slice(cursor);
}
