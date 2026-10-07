/** Small offline candidate ranker, not a generative or semantic language model. */
import type { DocumentSpellingModel } from './document-features';
import { documentContext, documentFeatures } from './document-features';
import { neuralCandidates, neuralIndex } from './features';
import { predictNetwork } from './network';
import { tokenize } from '../local-ai/core';
import { isEstablishedSurface } from '../lexicon';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { isForeignTechnicalStem } from '../technical';
import { preservesDiacritics } from './diacritics';
import type { PairedModel } from '../local-ai/paired';
import type { Token } from '../local-ai/core';

export type InstitutionalModel = Omit<DocumentSpellingModel, 'featureVersion'> & { featureVersion: 2 };
export function institutionalFeatures(lexicon: PairedModel, raw: string, candidate: string, tokens: readonly Token[], at: number): number[] {
  const values = documentFeatures(lexicon, raw, candidate, tokens, at);
  // Withhold the memorized typo-to-target count; context, validated
  // morphology and edit channels must support unseen spelling decisions.
  values[2] = 0;
  return values;
}

export function createInstitutionalHead(model: InstitutionalModel): (text: string) => string {
  const network = model.network;
  if (model.version !== 1 || model.featureVersion !== 2 || network.inputs !== 24 || network.hidden !== 12
    || network.w1.length !== 288 || network.b1.length !== 12 || network.w2.length !== 12
    || ![...network.w1, ...network.b1, ...network.w2, network.b2].every(Number.isFinite)
    || !Number.isFinite(model.threshold) || model.threshold < 0.9999 || model.threshold > 1
    || !Number.isFinite(model.margin) || model.margin < 0.2 || model.minimumContext < 2) throw new Error('Invalid institutional spelling model.');
  const index = neuralIndex(model.lexicon);
  return text => {
    const tokens = tokenize(text);
    let output = '', cursor = 0;
    tokens.forEach((token, at) => {
      const raw = token.word, lower = raw.toLocaleLowerCase('az-AZ');
      if (!/^[a-zəçğıöşü]{4,24}$/u.test(lower) || /^[\p{Lu}]+$/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw)
        || isEstablishedSurface(raw) || isCanonicalEntity(raw) || canonicalProtectedTerm(raw) || isForeignTechnicalStem(raw)) return;
      const candidates = neuralCandidates(model.lexicon, index, lower).filter(word => isEstablishedSurface(word) && preservesDiacritics(raw, word));
      if (!candidates.length) return;
      const ranked = [...new Set([lower, ...candidates])].map(word => ({ word,
        score: predictNetwork(network, institutionalFeatures(model.lexicon, lower, word, tokens, at)) }))
        .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
      const best = ranked[0];
      if (best.word === lower || best.score < model.threshold || best.score - (ranked[1]?.score ?? 0) < model.margin
        || documentContext(model.lexicon, best.word, tokens, at) < model.minimumContext) return;
      const target = /^\p{Lu}/u.test(raw) ? best.word[0].toLocaleUpperCase('az-AZ') + best.word.slice(1) : best.word;
      output += text.slice(cursor, token.start) + target; cursor = token.end;
    });
    return output + text.slice(cursor);
  };
}
