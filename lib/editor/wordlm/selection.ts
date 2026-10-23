import { dictionaryCandidates, foldLetters } from '../dictionary';
import { boundedEditDistance, spellingCandidates } from '../spelling-candidates';
import { editChannels, normalizeDigraphs } from '../local-ai/paired';
import paired from '../local-ai/paired-model.json';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { isEstablishedSurface } from '../lexicon';
import type { LanguageServices } from '../language-services';
import type { DiagnosticSink, CandidateDiagnostic } from '../diagnostics';
import { chooseWordLMSpelling, rankWordLM, wordLMSurfacePenalty } from './runtime';
import { wordLMTokens } from './core';
import selectedPolicy from './selection-policy.json';

export interface WordLMSelectionPolicy { lmWeight: number; editPenalty: number; changePenalty: number; minimumMargin: number }
export const experimentalWordLMPolicy: WordLMSelectionPolicy = selectedPolicy;
const wordPattern = () => /\p{L}+(?:[-’']\p{L}+)*/gu;
const folded = (text: string) => foldLetters(normalizeDigraphs(text.toLocaleLowerCase('az-AZ')));
const channelCounts: Record<string, number> = paired.channels;
const channelTotal = Object.values(channelCounts).reduce((sum, count) => sum + count, 0) + Object.keys(channelCounts).length;

/** Conservative local alignment. Ambiguous multiword rewrites are not re-ranked. */
function origins(original: string, current: string) {
  const before = [...original.matchAll(wordPattern())], after = [...current.matchAll(wordPattern())];
  const result = new Map<number, RegExpMatchArray>();
  let at = 0;
  for (let index = 0; index < after.length && at < before.length; index++) {
    const word = after[index], key = folded(word[0]);
    if (folded(before[at][0]) === key) { result.set(word.index!, before[at++]); continue; }
    const nearby = before.slice(at + 1, at + 9).findIndex(raw => folded(raw[0]) === key);
    const match = nearby < 0 ? -1 : at + 1 + nearby;
    const followingMatches = after[index + 1] && before[at + 1]
      && folded(after[index + 1][0]) === folded(before[at + 1][0]);
    if ((followingMatches || index === after.length - 1 && at === before.length - 1)
      && boundedEditDistance(folded(before[at][0]), key, 2) <= 2) result.set(word.index!, before[at++]);
    else if (match >= 0) { result.set(word.index!, before[match]); at = match + 1; }
  }
  return result;
}

/** The error channel uses existing synthetic edit counts plus validation-selected
 * penalties. Scores are relative rankings, never calibrated correctness probabilities. */
export function channelLogScore(raw: string, candidate: string, policy: WordLMSelectionPolicy): number {
  if (raw === candidate) return 0;
  const normalized = normalizeDigraphs(raw), edits = editChannels(normalized, candidate);
  return -policy.changePenalty - policy.editPenalty * boundedEditDistance(folded(raw), folded(candidate), 2)
    + edits.reduce((score, channel) => score + Math.log(((channelCounts[channel] ?? 0) + 1) / channelTotal), 0);
}

export function selectSpellingWithWordLM(original: string, text: string, services: LanguageServices,
  options: { enabled: boolean; experimental?: boolean; policy?: WordLMSelectionPolicy; diagnostics?: DiagnosticSink }): string {
  const policy = options.policy ?? experimentalWordLMPolicy;
  if (!Object.values(policy).every(value => Number.isFinite(value) && value >= 0) || policy.minimumMargin < Math.log(20)) throw new Error('Invalid experimental WordLM policy');
  const mapping = origins(original, text);
  return text.replace(wordPattern(), (current, offset: number) => {
    const origin = mapping.get(offset);
    if (!origin) return current;
    const raw = origin[0];
    if (!/^[a-z]{3,24}$/u.test(raw) || canonicalProtectedTerm(raw) || isCanonicalEntity(raw)) return current;
    const left = wordLMTokens(text.slice(0, offset).split(/[.!?;\n\uE000\uE001]/u).at(-1) ?? '').slice(-2).map(word => services.spelling.resolve(word, services));
    const right = wordLMTokens(text.slice(offset + current.length).split(/[.!?;\n\uE000\uE001]/u)[0]).slice(0, 2).map(word => services.spelling.resolve(word, services));
    const ruleProposal = services.spelling.resolve(raw, services);
    const proposals = new Map<string, string[]>([[raw, ['retain-input']]]);
    const add = (word: string | undefined, source: string) => {
      if (!word || word !== raw && (!/^\p{Ll}+$/u.test(word) || !isEstablishedSurface(word, services))) return;
      const sources = proposals.get(word);
      if (sources) { if (!sources.includes(source)) sources.push(source); }
      else if (proposals.size < 8) proposals.set(word, [source]);
    };
    add(current, 'preceding-stages'); add(ruleProposal, 'spelling-rules');
    for (const word of dictionaryCandidates(raw) ?? []) add(word, 'dictionary');
    add(services.morphology.findByFoldedForm?.(raw), 'morphology');
    if (proposals.size < 8) for (const word of spellingCandidates.candidates(raw, 4)) add(word, 'edit-candidates');
    const candidates: CandidateDiagnostic['candidates'] = rankWordLM(left, [...proposals.keys()], right).map(row => {
      const channel = channelLogScore(raw, row.word, policy);
      const oovLogPenalty = wordLMSurfacePenalty(row.word);
      return { word: row.word, sources: proposals.get(row.word)!, lmLogScore: row.score, oovLogPenalty,
        channelLogScore: channel, score: policy.lmWeight * (row.score - oovLogPenalty) + channel, evidence: row.evidence };
    }).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
    const legacy = options.enabled && !isEstablishedSurface(current, services) ? chooseWordLMSpelling(current, left, right) : undefined;
    const baselineProposal = legacy && isEstablishedSurface(legacy, services) ? legacy : current;
    let selected = baselineProposal, reason = 'existing pipeline decision retained';
    if (!options.enabled) reason = 'WordLM disabled in this comparison';
    else if (!options.experimental) {
      if (baselineProposal !== current) reason = 'legacy WordLM fallback accepted';
    } else {
      const [best, second] = candidates;
      if (dictionaryCandidates(raw)?.has(raw) || isEstablishedSurface(raw, services)) reason = 'explicit valid input preserved';
      else if (!best || !second || !best.evidence || !Number.isFinite(best.score) || !Number.isFinite(second.score)) reason = 'insufficient observed lexical evidence';
      else if (best.score - second.score < policy.minimumMargin) reason = 'insufficient joint-score margin';
      else { selected = best.word; reason = selected === raw ? 'joint ranker retained the original word' : 'joint context and edit-channel ranking accepted'; }
    }
    options.diagnostics?.({ kind: 'candidates', source: 'wordlm-selection', raw, rawStart: origin.index!, current, ruleProposal, baselineProposal,
      mode: !options.enabled ? 'disabled' : options.experimental ? 'experimental' : 'fallback', candidates, selected, reason });
    return selected;
  });
}
