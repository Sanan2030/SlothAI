import { finiteAnalyses, agreementForms } from './morphology';
import { isFinitePredicate } from '../segmentation';
import artifact from './model.json';
import pairedArtifact from '../local-ai/paired-model.json';
import { predictNetwork } from './network';
import { neuralIndex, neuralCandidates, lexicalFeatures, agreementFeatures, subjects, type Subject } from './features';
import type { NeuralArtifact } from './types';
import { tokenize, fold } from '../local-ai/core';
import { dictionaryCandidates } from '../dictionary';
import { productiveMorphology } from '../productive-morphology';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
const model = artifact as NeuralArtifact, index = neuralIndex(model.lexicon);

/** Explicit diacritics may shift with inserted/deleted letters, but may not
 * themselves be erased or replaced. Work is bounded by the token length. */
export function preservesDiacritics(raw: string, target: string): boolean {
  const a = [...raw.toLocaleLowerCase('az-AZ')], b = [...target.toLocaleLowerCase('az-AZ')];
  const protectedLetter = (letter: string) => /[əıçğöşü]/u.test(letter);
  let previous = b.map((_, at) => at + 1); previous.unshift(0);
  for (let i = 1; i <= a.length; i++) {
    const current = [protectedLetter(a[i - 1]) ? Infinity : previous[0] + 1];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(
      current[j - 1] + 1, protectedLetter(a[i - 1]) ? Infinity : previous[j] + 1,
      previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : protectedLetter(a[i - 1]) ? Infinity : 1));
    previous = current;
  }
  return previous[b.length] <= 4;
}

/** This network repairs unknown surfaces. Established/explicit valid words win. */
export function neuralSpelling(text: string): string {
  const tokens = tokenize(text); let result = '', cursor = 0;
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at], raw = token.word, lower = raw.toLocaleLowerCase('az-AZ');
    if (!/^[\p{L}]{4,24}$/u.test(raw) || model.lexicon.words[lower] || Object.hasOwn(pairedArtifact.words, lower)
      || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)
      || canonicalProtectedTerm(raw) || isCanonicalEntity(raw)
      || dictionaryCandidates(lower)?.has(lower) || productiveMorphology.isValidWordForm(raw)) continue;
    // Known errors use frozen prior weights; new errors use the newly trained head.
    const lexicalNetwork = model.lexicalAnchor && Object.values(model.lexicon.edits[lower] ?? {}).some(count => count >= 3) ? model.lexicalAnchor : model.lexical;
    // Short forms often represent different valid verbs (itdi/etdi).
    // Require direct learned evidence before attempting their spelling.
    if (lower.length < 5 && !Object.hasOwn(model.lexicon.edits, lower)) continue;
    const choices = neuralCandidates(model.lexicon, index, raw).map(word => ({ word,
      score: predictNetwork(lexicalNetwork, lexicalFeatures(model.lexicon, raw, word, tokens, at)) }))
      .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
    const best = choices[0];
    if (!best || best.score < model.lexicalThreshold || best.score - (choices[1]?.score ?? 0) < model.lexicalMargin) continue;
    const learned = model.lexicon.edits[lower]?.[best.word] ?? 0;
    const repeatedLetterRepair = [...lower].some((letter, i) => i > 0 && letter === lower[i - 1]
      && fold(lower.slice(0, i) + lower.slice(i + 1)) === fold(best.word));
    // Do not infer a case-ending deletion from an unseen spelling variant.
    if (!learned && lower.length !== best.word.length && !repeatedLetterRepair) continue;
    if (!learned && /(?:anda|əndə|arkən|ərkən|ınca|incə)$/u.test(lower)) continue;
    if (fold(raw) === fold(best.word)) continue; // Existing context model owns diacritics-only ambiguity.
    if (!preservesDiacritics(raw, best.word)) continue;
    const target = /^\p{Lu}/u.test(raw) ? best.word[0].toLocaleUpperCase('az-AZ') + best.word.slice(1) : best.word;
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
      return rows.some(row => row.lemma === original.lemma && row.features.tense === original.features.tense && JSON.stringify(row.features.derivation ?? []) === JSON.stringify(original.features.derivation ?? []) && predictNetwork(model.agreement, agreementFeatures(subject!, row.features)) >= model.agreementThreshold);
    });
    if (candidates.length === 1 && candidates[0] !== word) {
      result += text.slice(cursor, token.start) + candidates[0]; cursor = token.end;
    }
    subject = undefined; // Stop at the first finite predicate, not an arbitrary later verb.
  }
  return result + text.slice(cursor);
}
