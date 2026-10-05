import artifact from './document-model.json';
import type { DocumentSpellingModel } from './document-features';
import { documentContext, documentFeatures } from './document-features';
import { neuralCandidates, neuralIndex } from './features';
import { predictNetwork } from './network';
import { tokenize, fold } from '../local-ai/core';
import { normalizeDigraphs } from '../local-ai/paired';
import { isEstablishedSurface } from '../lexicon';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { isForeignTechnicalStem } from '../technical';
import { preservesDiacritics } from './diacritics';

const model = artifact as DocumentSpellingModel;
const index = neuralIndex(model.lexicon);

/** A small source-trained spelling ranker. Existing valid words are preserved.
 * It can restore ASCII/digraph spelling in a supported local context; it does
 * not replay source sentences, infer general meaning or generate new prose. */
export function documentSpelling(text: string): string {
  const tokens = tokenize(text);
  let output = '', cursor = 0;
  tokens.forEach((token, at) => {
    const raw = token.word, lower = raw.toLocaleLowerCase('az-AZ');
    if (!/^[a-zəçğıöşü]{4,24}$/u.test(lower) || /^[\p{Lu}]+$/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw)
      || isEstablishedSurface(raw) || isCanonicalEntity(raw) || canonicalProtectedTerm(raw) || isForeignTechnicalStem(raw)) return;
    const candidates = neuralCandidates(model.lexicon, index, lower)
      .filter(candidate => fold(normalizeDigraphs(lower)) === fold(candidate) && preservesDiacritics(raw, candidate));
    if (!candidates.length) return;
    const ranked = [...new Set([lower, ...candidates])].map(word => ({ word,
      score: predictNetwork(model.network, documentFeatures(model.lexicon, lower, word, tokens, at)) }))
      .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
    const best = ranked[0];
    if (best.word === lower || best.score < model.threshold || best.score - (ranked[1]?.score ?? 0) < model.margin
      || !isEstablishedSurface(best.word) || documentContext(model.lexicon, best.word, tokens, at) < model.minimumContext) return;
    const replacement = /^\p{Lu}/u.test(raw) ? best.word[0].toLocaleUpperCase('az-AZ') + best.word.slice(1) : best.word;
    output += text.slice(cursor, token.start) + replacement;
    cursor = token.end;
  });
  return output + text.slice(cursor);
}
