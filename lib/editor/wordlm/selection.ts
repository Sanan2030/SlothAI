import { dictionaryCandidates, foldLetters } from '../dictionary';
import { boundedEditDistance, spellingCandidates } from '../spelling-candidates';
import { editChannels, normalizeDigraphs } from '../local-ai/paired';
import paired from '../local-ai/paired-model.json';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { isEstablishedSurface, isReviewedSpelling } from '../lexicon';
import { isForeignTechnicalInflection } from '../technical';
import type { LanguageServices } from '../language-services';
import type { DiagnosticSink, CandidateDiagnostic } from '../diagnostics';
import { chooseWordLMSpelling, rankWordLM, wordLMSurfacePenalty } from './runtime';
import type { WordLMDecisions } from './runtime';
import { wordLMTokens } from './core';
import selectedPolicy from './selection-policy.json';
import { attestedSpellingCandidates, hasAttestedSpelling } from './lexical-evidence';
import { spellingContextAdjustments } from './context-runtime';

export interface WordLMSelectionPolicy { lmWeight: number; editPenalty: number; changePenalty: number; minimumMargin: number }
export const automaticWordLMPolicy: WordLMSelectionPolicy = selectedPolicy;
/** Compatibility name for existing offline policy-selection scripts. */
export const experimentalWordLMPolicy = automaticWordLMPolicy;
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
  options: { enabled: boolean; experimental?: boolean; automatic?: boolean; policy?: WordLMSelectionPolicy; diagnostics?: DiagnosticSink; decisions?: WordLMDecisions; onChange?: (raw: string, selected: string) => void }): string {
  const policy = options.policy ?? experimentalWordLMPolicy;
  if (!Object.values(policy).every(value => Number.isFinite(value) && value >= 0) || policy.minimumMargin < Math.log(20)) throw new Error('Invalid experimental WordLM policy');
  const mapping = origins(original, text);
  const resolved = new Map<string, string>(), established = new Map<string, boolean>();
  const resolve = (word: string) => {
    let value = resolved.get(word);
    if (value === undefined) { value = services.spelling.resolve(word, services); resolved.set(word, value); }
    return value;
  };
  const known = (word: string) => {
    let value = established.get(word);
    if (value === undefined) { value = isEstablishedSurface(word, services); established.set(word, value); }
    return value;
  };
  return text.replace(wordPattern(), (current, offset: number) => {
    const origin = mapping.get(offset);
    if (!origin) return current;
    const rawSurface = origin[0], raw = rawSurface.toLocaleLowerCase('az-AZ');
    if (!/^[a-zəçğıöşü]{2,40}$/u.test(raw) || /\p{Ll}\p{Lu}/u.test(rawSurface)
      || rawSurface.length > 1 && rawSurface === rawSurface.toLocaleUpperCase('az-AZ')
      || canonicalProtectedTerm(rawSurface) || isCanonicalEntity(rawSurface)) return current;
    // Earlier entity/technical decisions retain their lexical identity. The LM
    // still uses them as context for neighbouring uncertain words.
    if (canonicalProtectedTerm(current) || isCanonicalEntity(current)
      || current.length > 1 && current === current.toLocaleUpperCase('az-AZ') || /\p{Ll}\p{Lu}/u.test(current)) return current;
    const currentWord = current.toLocaleLowerCase('az-AZ');
    const attested = attestedSpellingCandidates(rawSurface);
    const validRaw = dictionaryCandidates(raw)?.has(raw) || known(raw) || hasAttestedSpelling(raw);
    // Whole native spellings with explicit lexical evidence retain the author's
    // meaning. A mixed/unknown spelling still gets a complete candidate search.
    const explicitNative = /[əçğıöşü]/u.test(rawSurface) && (dictionaryCandidates(raw)?.has(raw) || hasAttestedSpelling(raw));
    if (validRaw && !options.diagnostics && !attested.some(word => word !== raw)) return current;
    const left = wordLMTokens(text.slice(0, offset).split(/[.!?;\n\uE000\uE001]/u).at(-1) ?? '').slice(-2).map(resolve);
    const right = wordLMTokens(text.slice(offset + current.length).split(/[.!?;\n\uE000\uE001]/u)[0]).slice(0, 2).map(resolve);
    const ruleProposal = resolve(raw).toLocaleLowerCase('az-AZ');
    const proposals = new Map<string, string[]>([[raw, ['retain-input']]]);
    const add = (word: string | undefined, source: string) => {
      if (!word || word !== raw && (!/^\p{Ll}+$/u.test(word) || !known(word) && !hasAttestedSpelling(word))) return;
      const sources = proposals.get(word);
      if (sources) { if (!sources.includes(source)) sources.push(source); }
      else if (proposals.size < 8) proposals.set(word, [source]);
    };
    add(currentWord, 'preceding-stages'); add(ruleProposal, 'spelling-rules');
    for (const word of attested) add(word, 'wordlm-vocabulary');
    for (const word of dictionaryCandidates(raw) ?? []) add(word, 'dictionary');
    add(services.morphology.findByFoldedForm?.(raw), 'morphology');
    if (proposals.size < 8) for (const word of spellingCandidates.candidates(raw, 4)) add(word, 'edit-candidates');
    const lmRows = rankWordLM(left, [...proposals.keys()], right);
    const contextRows = spellingContextAdjustments(raw, left, right,
      lmRows.map(row => ({ word: row.word, logScore: row.score - wordLMSurfacePenalty(row.word) })));
    const contextual = new Map(contextRows.map(row => [row.word, row]));
    const candidates: CandidateDiagnostic['candidates'] = lmRows.map(row => {
      const channel = channelLogScore(raw, row.word, policy);
      const oovLogPenalty = wordLMSurfacePenalty(row.word);
      const context = contextual.get(row.word), contextLogAdjustment = context?.logAdjustment ?? 0;
      const contextEvidence = (context?.examples ?? 0) >= 3;
      return { word: row.word, sources: proposals.get(row.word)!, lmLogScore: row.score, oovLogPenalty,
        bridgeEvidence: row.bridgeEvidence || Boolean(contextEvidence && context?.bridge),
        sourceContextExamples: context?.examples ?? 0, sourceContextBridge: Boolean(context?.bridge), contextLogAdjustment,
        channelLogScore: channel, score: policy.lmWeight * (row.score - oovLogPenalty + contextLogAdjustment) + channel, evidence: row.evidence || contextEvidence };
    }).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
    if (options.enabled && options.decisions) {
      options.decisions.rankedTokens++; options.decisions.candidatesScored += candidates.length;
      if (contextRows.length) options.decisions.contextualTokens++;
    }
    const legacy = options.enabled && !known(currentWord) ? chooseWordLMSpelling(currentWord, left, right) : undefined;
    const baselineProposal = legacy && known(legacy) ? legacy : currentWord;
    let selected = baselineProposal, reason = 'existing pipeline decision retained';
    if (!options.enabled) reason = 'WordLM disabled in this comparison';
    else if (!options.experimental) {
      if (baselineProposal !== current) reason = 'legacy WordLM fallback accepted';
    } else {
      const [best, second] = candidates;
      const uniqueAttested = attested.filter(word => word !== raw);
      const lexicalContext = [...left.slice(-1), ...right.slice(0, 1)].some(known);
      const literalRaw = Boolean(dictionaryCandidates(raw)?.has(raw) || hasAttestedSpelling(raw));
      const sourceRepairCandidate = raw.length >= 4 && uniqueAttested.length === 1 && !literalRaw
        && !explicitNative && !isReviewedSpelling(rawSurface) && !isForeignTechnicalInflection(rawSurface)
        && folded(currentWord) === folded(raw) && !hasAttestedSpelling(currentWord)
        && known(uniqueAttested[0]) && lexicalContext;
      // A source spelling can resolve an ungrounded morphological guess. Other
      // preceding decisions (reviewed phrases, entities, technical terms) keep
      // their authority even when absent from the bounded model vocabulary.
      const currentAnalyses = sourceRepairCandidate ? services.morphology.analyzeWord(currentWord) : [];
      const grounded = (rows: ReturnType<typeof services.morphology.analyzeWord>, surface: string) => rows.some(row =>
        row.surface === surface && (hasAttestedSpelling(row.lemma) || /[əçğıöşü]/u.test(row.lemma)));
      const uniqueSourceRepair = sourceRepairCandidate
        && (currentWord === raw || currentAnalyses.length > 0 && !grounded(currentAnalyses, currentWord))
        && (!known(raw) || !grounded(services.morphology.analyzeWord(raw), raw));
      const bestSourceExamples = best?.sourceContextExamples ?? 0;
      const nativeContextProof = Boolean(best?.sourceContextBridge && bestSourceExamples >= 3
        && bestSourceExamples / ((contextual.get(raw)?.examples ?? 0) + 1) >= Math.exp(policy.minimumMargin));
      if (explicitNative && !nativeContextProof) reason = 'explicit valid input preserved without decisive bilateral source evidence';
      else if (best && currentWord !== raw && known(currentWord) && folded(currentWord) !== folded(raw)
        && best.word !== currentWord && folded(best.word) === folded(raw)) reason = 'verified structural correction retained';
      else if (uniqueSourceRepair) { selected = uniqueAttested[0]; reason = 'unique source spelling resolves an ungrounded morphological guess'; }
      else if (raw.length === 2 && !best?.bridgeEvidence) reason = 'short grammatical words require bilateral context';
      else if (validRaw && hasAttestedSpelling(raw) && !best?.bridgeEvidence) reason = 'attested valid meanings require bilateral context';
      else if (validRaw && !best?.evidence) reason = 'valid input requires observed context for a meaning change';
      else if (!best || !second || !Number.isFinite(best.score) || !Number.isFinite(second.score)
        || !best.evidence && (uniqueAttested.length !== 1 || best.word !== uniqueAttested[0]
          || folded(best.word) !== folded(raw) || !lexicalContext)) reason = 'insufficient observed lexical evidence';
      else if (best.score - second.score < policy.minimumMargin) reason = 'insufficient joint-score margin';
      else if (best.word === raw && currentWord !== raw && known(currentWord)) reason = 'verified correction retained over an unattested raw spelling';
      else { selected = best.word; reason = selected === raw ? 'joint ranker retained the original word' : 'joint context and edit-channel ranking accepted'; }
    }
    const surface = selected === currentWord ? current
      : /^\p{Lu}/u.test(current) ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
    options.diagnostics?.({ kind: 'candidates', source: 'wordlm-selection', raw: rawSurface, rawStart: origin.index!, current, ruleProposal, baselineProposal,
      mode: !options.enabled ? 'disabled' : options.automatic ? 'automatic' : options.experimental ? 'experimental' : 'fallback', candidates, selected: surface, reason });
    if (options.enabled && options.decisions && surface !== current) options.decisions.changedTokens++;
    if (options.enabled && surface !== current) options.onChange?.(rawSurface, surface);
    return surface;
  });
}
