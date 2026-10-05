import { guardInsertedBoundaries } from './syntax-boundary-guard';
import { observedSpelling, repairObservedSpacing } from './observed-channel';
import { preserveContextualHomographs, normalizeClauseParticles, segmentDiscourseClauses } from './context-decisions';
import { punctuateSubjectPronouns } from './grammatical-commas';
import { editHTMLStructure } from './html-structure';
import { editStructuredText } from './structured-text';
import { neuralSpelling, neuralAgreement, neuralTranspositions, type NeuralSpellingFallback } from './neural/runtime';
import { dictionaryCandidates } from './dictionary';
import { isEstablishedSurface } from './lexicon';
import { productiveMorphology } from './productive-morphology';
import { segmentCorrespondence } from './correspondence-boundaries';
import { prepareReviewedContext } from './reviewed-context';
import { languageServices, type LanguageServices } from './language-services';
import { repairPhrases, sentenceBoundaries } from './context';
import { punctuateNarrative, narrativeParagraphs } from './narrative';
import { beforeLexicalCorrection, extendedPhrases, extendedBoundaries } from './extended-narrative';
import { expositoryPhrases, punctuateExpository } from './expository';
import { businessPhrases, punctuateBusiness, businessLayout, businessStageLists } from './business';
import { prepareTechnicalPhrases, technicalPhrases, punctuateTechnical } from './technical';
import { protectKnownTerminology, canonicalProtectedTerm } from './protected-terminology';
import { paragraphEmailBody, parseEmailSections, prepareEmailBody } from './rules/email';
import { chooseByGrammar, chooseInflectedPlace, chooseBySentence, sentenceEvidence } from './contextual-choices';
import { isEmailGreeting } from './email-greetings';
import { createLocalPredictor, insertLearnedBoundaries } from './local-ai/predict';
import { createPairedPredictor } from './local-ai/paired-runtime';
import { jointContextTokens, insertJointBoundaries, type JointBoundaryModel } from './local-ai/joint-boundary';
import jointArtifact from './local-ai/joint-boundary-model.json';
import { segmentIndependentClauses, isFinitePredicate } from './segmentation';
import { detectExclamation, detectQuestion, punctuateCommas, terminalPunctuation } from './punctuation';
import { segmentParagraphs } from './paragraph-segmentation';
import { isCanonicalEntity, protectMultiwordEntities, resolveEntitiesInText, resolveEntityWord } from './entities/resolver';

import { MAX_TEXT_LENGTH } from './limits';
import { protectInitialNames } from './initial-names';
import { insertNeuralBoundaries } from './neural/boundary-runtime';
import type { NeuralBoundaryArtifact } from './neural/boundary-features';
export { MAX_TEXT_LENGTH } from './limits';
export interface LocalCorrection { text: string; corrections: number }
export interface CorrectionEvent {
  stage: 'spelling';
  original: string;
  replacement: string;
  reason: string;
}
export interface CorrectionRuntime {
  /** Ablation for the real-input edit channel and conservative space repair. */
  useObservedChannel?: boolean;
  /** Isolate the compact gap network in offline comparisons. */
  useNeuralBoundary?: boolean;
  /** Evaluation-only candidate checkpoint; application callers use the bundled model. */
  boundaryModel?: NeuralBoundaryArtifact;
  /** Offline evaluation seam. Application callers retain established heads. */
  neuralFallback?: NeuralSpellingFallback;
  /** Isolate the source-trained fallback without disabling existing heads. */
  useBounded?: boolean;
  /** Evaluation switch; both application strategies enable the local model by default. */
  useLocalModel?: boolean;
  /** Isolate the attention head for offline ablation; default production behavior stays enabled. */
  useAttention?: boolean;
  services?: LanguageServices;
  trace?: (event: CorrectionEvent) => void;
}

function capitalize(text: string): string {
  return text.replace(/(^[“«"(]?|[.!?]\s+[“«"(]?|\n(?:\d+[.)]|[-*])\s+)([a-zəçğıöşü]\p{L}*)/gu,
    (_, prefix: string, word: string) => prefix + word[0].toLocaleUpperCase(canonicalProtectedTerm(word) ? 'en-US' : 'az-AZ') + word.slice(1));
}

function punctuate(line: string, useLocalModel = true, runtime: CorrectionRuntime = {}): string {
  if (!line.trim()) return '';
  // Documentary headings and standalone subtitles are structure, not prose.
  if (/^===.+===$/u.test(line.trim()) || /^[A-ZƏÇĞIİÖŞÜ\s-]{3,}$/u.test(line.trim()) || (/^\(.+\)$/u.test(line.trim()) && line.trim().length <= 160)) return line.trim();
  if (/^salam,$/i.test(line.trim())) return 'Salam,';
  if (/^mövzu:/i.test(line.trim())) return capitalize(line.trim());
  if (/^hörmətlə[,!.]?$/i.test(line.trim())) return 'Hörmətlə,';
  if (/^hörmətli [^.!?]+[,]?$/i.test(line.trim()) && (/^hörmətli\s+\p{L}+(?:\s+(?:xanım|bəy))?[,]?$/iu.test(line.trim()) || !line.split(/\s+/u).some(isFinitePredicate))) return capitalize(line.trim().replace(/[,.]?$/, ','));
  let result = line.replace(/[\t ]+/g, ' ').trim()
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/([,;:!?])\1+/g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/([!?])[.,]+/g, '$1')
    .replace(/\s+\./g, '.')
    .replace(/\.(?=[A-Za-zƏəÇçĞğİıÖöŞşÜü])/g, '. ')
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/([,;:!?])(?=[a-zA-ZəƏçÇğĞıİöÖşŞüÜ])/g, '$1 ');
  const boundarySource = result;
  result = sentenceBoundaries(result);
  result = punctuateNarrative(result);
  result = extendedBoundaries(result);
  result = punctuateExpository(result);
  result = punctuateBusiness(result);
  result = punctuateTechnical(result);
  result = segmentDiscourseClauses(segmentCorrespondence(segmentIndependentClauses(result)), isFinitePredicate);
  // Scope-aware learned decisions run after deterministic clauses have been established.
  if (useLocalModel) result = insertLearnedBoundaries(result);
  if (useLocalModel) result = insertJointBoundaries(result, jointArtifact as JointBoundaryModel);
  if (useLocalModel && runtime.useNeuralBoundary !== false) result = insertNeuralBoundaries(result, runtime.boundaryModel);
  result = guardInsertedBoundaries(boundarySource, result);
  result = punctuateCommas(result);
  // Only well-defined conversational patterns are split; no guessed sentence
  // boundary before every pronoun or arbitrary verb.
  result = result
    .replace(/^(salam)\s+(?=[a-zəçğıöşü])/i, '$1, ')
    .replace(/(^|^salam,\s*|[.!?]\s+)(necəsən|necəsiniz)(?=\s+(?:mən|sən|biz|siz)\s|\s+(?:necə|nə)\s|$)/gi, '$1$2?');
  if (!/[.!?:;…]["”»)]?$/.test(result)) {
    const lastSentence = result.split(/[.!?]\s+/).at(-1) ?? result;
    const indirect = /(?:bilirəm|bilirik|bilirsiniz|öyrəndim|izah etdi|dedi)[)”»"]?$/i.test(lastSentence)
      && !/(?:^|\s)nə\s+bilirik$/iu.test(lastSentence);
    const exclamation = /^nə (?:gözəl|yaxşı|pis|qəribə)\s/i.test(lastSentence);
    const discourseMarker = /^nə isə(?:\s|$)/i.test(lastSentence);
    const alternativeQuestion = /,\s*yoxsa\s+[^.!?]+$/iu.test(lastSentence);
    const tagQuestion = /,\s*düzdür$/iu.test(lastSentence);
    const question = !indirect && !exclamation && !discourseMarker && (alternativeQuestion || tagQuestion || detectQuestion(lastSentence));
    result = question && !detectExclamation(result) ? result + '?' : terminalPunctuation(result);
  }
  return capitalize(result);
}

function enumerate(line: string): string[] {
  // Require explicit numeric markers 1) ... 2) ... or ordinal transition words
  // followed by punctuation. Bare "birinci sinif" is never turned into a list.
  const numeric = [...line.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];
  const ordinals = [...line.matchAll(/(?:^|\s)(birinci|ikinci|üçüncü|dördüncü|beşinci)[:,]\s+/gi)];
  const matches = numeric.length >= 2 ? numeric : ordinals;
  if (matches.length < 2) return [line];
  const order = ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci'];
  if (!matches.every((match, index) => (numeric.length >= 2
    ? Number(match[1]) : order.indexOf(match[1].toLocaleLowerCase('az-AZ')) + 1) === index + 1)) return [line];
  const prefix = line.slice(0, matches[0].index).trim().replace(/[.:]$/, '');
  const items = matches.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    return `${index + 1}. ${line.slice(start, end).trim().replace(/[;,]$/, '')}`;
  });
  return prefix ? [prefix + ':', ...items] : items;
}

/** Deterministic, bounded, synchronous editor; no fetch or environment access; bundled local statistical artifacts. */
export function correctText(input: string, preserveFormatting = false, runtime: CorrectionRuntime = {}): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  let corrections = 0;
  const edit = (value: string) => {
    if (!value.trim()) return value;
    const result = correctPlainText(value, true, runtime); corrections += result.corrections; return result.text;
  };
  const structured = editStructuredText(input, edit, preserveFormatting) ?? editHTMLStructure(input, edit);
  return structured === undefined ? correctPlainText(input, preserveFormatting, runtime)
    : { text: structured, corrections: structured === input ? 0 : Math.max(1, corrections) };
}

function correctPlainText(input: string, preserveFormatting = false, runtime: CorrectionRuntime = {}): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  const services = runtime.services ?? languageServices;
  const restoreWord = (word: string) => isCanonicalEntity(word) || /^eləmi$/iu.test(word) ? word : services.spelling.resolve(word, services);
  const protectedText: string[] = [];
  // Reserve an unused delimiter; user-supplied private-use characters cannot
  // accidentally collide with our placeholders.
  let marker = '\uE000';
  while (input.includes(marker)) marker += '\uE000';
  const protect = (value: string) => `${marker}${protectedText.push(value) - 1}\uE001`;
  // Attribute values (including ?id=7) are markup, not sentence punctuation.
  let text = input.replace(/<!--[\s\S]*?-->|```[\s\S]*?```|`[^`\n]*`|\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)|<\/?[A-Za-z][^<>\n]*?>|https?:\/\/[^\s<>]+|\bas is\b|\bto be\b|\bchess comda\b|\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b|\b\d+(?:[.,:\/-]\d+)+(?:%|\b)|\b(?:www\.[\w.-]+|[\w-]+\.(?:com|org|net|az))\b|\b(?:dr|prof|dos|müh)\.(?=\s)|\b[A-Za-z]+[A-Za-z0-9]*[_/][\w/.-]+\b/gi, value => {
    if (/^chess comda$/i.test(value)) return protect('Chess.com-da');
    if (/^https?:/.test(value)) {
      const suffix = value.match(/[.,!?;:]+$/)?.[0] ?? '';
      return protect(suffix ? value.slice(0, -suffix.length) : value) + suffix;
    }
    return protect(value);
  });
  // Initials belong to the following proper name. A period in M.Füzuli is
  // not a sentence boundary; preserve the author's spacing and spelling.
  text = protectInitialNames(text, protect);
  text = text.replace(/\r\n?/g, '\n').normalize('NFC');
  text = prepareTechnicalPhrases(text);
  // Numeric/date/version values take Azerbaijani suffixes with a hyphen.
  text = text
    .replace(/(\d{1,2}:\d{2})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d+(?:\.\d+){1,3})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d{1,2})\s+(e|ə)(?=$|[^\p{L}])/giu, '$1-ə');
  // Keep lexical terminology visible to clause rules. Only punctuation-bearing
  // terms need opaque spans; spelling resolution already protects lexical terms.
  text = protectKnownTerminology(text, canonical =>
    /[.#]/u.test(canonical) || canonical === 'npm' || canonical === 'gRPC' ? protect(canonical) : canonical);
  text = protectMultiwordEntities(text, protect);
  text = resolveEntitiesInText(text);
  // Hunger adjective "ac" becomes opaque to prevent ac/aç overcorrection.
  // Establish its subject comma while the grammatical evidence is visible.
  text = preserveContextualHomographs(punctuateSubjectPronouns(text), protect);
  if (runtime.useObservedChannel !== false) {
    text = repairObservedSpacing(text);
    text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+/gu, word => {
      const selected = observedSpelling(word);
      if (!selected) return word;
      runtime.trace?.({ stage: 'spelling', original: word, replacement: selected, reason: 'reviewed real-input edit channel + verified morphology' });
      return /^\p{Lu}/u.test(word) ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
    });
  }
  if (runtime.useLocalModel !== false && runtime.useAttention !== false) text = neuralTranspositions(text, protect, runtime.neuralFallback ?? (runtime.useBounded === false ? null : undefined));
  // Type names are identifiers, not Azerbaijani prose (integer must not become
  // dotted-capital İnteger at the beginning of a generated sentence).
  text = text.replace(/(?<![\p{L}\p{N}_])(?:integer|string|protobuf|integration|timer)(?![\p{L}\p{N}_])/giu, protect);
  text = prepareReviewedContext(beforeLexicalCorrection(text));
  text = prepareTechnicalPhrases(text);
  text = text.replace(/(^|[^\p{L}])bes(?=\s+(?:sen|sən|siz|biz|o)(?=$|[^\p{L}]))/giu, '$1bəs');
  // A conjunction versus a location is distinguished only in these explicit
  // predicates; "kitab məndədir" and "məndə kitab var" remain intact.
  text = text.replace(/(^|[^\p{L}])(mende|məndə)\s+(yaxsiyam|yaxşıyam|pisem|pisəm)(?=$|[^\p{L}])/giu,
    '$1mən də $3');
  if (runtime.useLocalModel !== false) {
    const paired = createPairedPredictor(text);
    text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[-’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*/g, (word, offset: number) => {
      if (isCanonicalEntity(word)) return word;
      const candidate = paired(word, offset);
      const established = restoreWord(word);
      // Preserve established spelling repairs, except a supervised digraph
      // correction whose context can distinguish səhər from şəhər.
      if (!candidate || !candidate.split(/\s+/u).every(value => isEstablishedSurface(value, services))
        || established !== word && !/(?:sh|ch|gh)/iu.test(word)
        && (dictionaryCandidates(established.toLocaleLowerCase('az-AZ'))?.has(established.toLocaleLowerCase('az-AZ'))
          || productiveMorphology.isValidWordForm(established))) return word;
      runtime.trace?.({ stage: 'spelling', original: word, replacement: candidate, reason: 'paired local model with context/POS' });
      return candidate;
    });
  }
  const sentenceEnds = [...text.matchAll(/[.!?\n]/gu)].map(match => match.index! + 1);
  const localPrediction = runtime.useLocalModel === false ? undefined : createLocalPredictor(text,
    jointContextTokens(text, restoreWord, jointArtifact as JointBoundaryModel));
  sentenceEnds.push(text.length);
  let sentenceStart = 0;
  let sentenceIndex = 0;
  let context = sentenceEvidence(text.slice(0, sentenceEnds[0]));
  text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[-’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*/g, (word, offset: number) => {
    while (sentenceEnds[sentenceIndex] <= offset && sentenceIndex < sentenceEnds.length - 1) {
      sentenceStart = sentenceEnds[sentenceIndex++];
      context = sentenceEvidence(text.slice(sentenceStart, sentenceEnds[sentenceIndex]));
    }
    const previousWord = text.slice(0, offset).match(/([\p{L}]+)\s+$/u)?.[1] ?? '';
    if (/^(?:karta|məcburi|artsa|kursu)$/iu.test(word)) return word;
    if (/^(?:uc|adi|suret)$/iu.test(word)) {
      const nextWord = text.slice(offset + word.length).match(/^\s+([\p{L}]+)/u)?.[1] ?? '';
      const previousWord = text.slice(0, offset).match(/([\p{L}]+)\s+$/u)?.[1] ?? '';
      const grammatical = chooseByGrammar(word, nextWord ? restoreWord(nextWord) : '',
        previousWord ? restoreWord(previousWord) : '');
      if (grammatical) return grammatical;
    }
    const contextual = chooseInflectedPlace(word, previousWord)
      ?? localPrediction?.(word, offset) ?? chooseBySentence(word, context);
    if (contextual && isEstablishedSurface(contextual, services)) return contextual;
    const attachedQuestion = word.match(/^([\p{L}]+(?:dır|dir|dur|dür|acaq|əcək|malı|məli|ır|ir|ur|ür|ırsan|irsən|ursan|ürsən|ıb|ib|ub|üb))(mı|mi|mu|mü)$/iu);
    if (attachedQuestion) {
      const base = restoreWord(attachedQuestion[1]);
      if (base !== attachedQuestion[1]) {
        const vowel = [...base.toLocaleLowerCase('az-AZ')].reverse().find(letter => /[aəeıioöuü]/u.test(letter));
        const harmony: Record<string, string> = { a: 'mı', ı: 'mı', e: 'mi', ə: 'mi', i: 'mi', o: 'mu', u: 'mu', ö: 'mü', ü: 'mü' };
        return base + (vowel ? harmony[vowel] : attachedQuestion[2]);
      }
    }
    const corrected = restoreWord(word);
    const replacement = corrected !== word || !word.includes('-') ? corrected : word.split('-').map(restoreWord).join('-');
    if (runtime.trace && replacement !== word) runtime.trace({ stage: 'spelling', original: word, replacement, reason: 'language-service spelling resolution' });
    return replacement;
  });
  if (runtime.useLocalModel !== false) text = neuralSpelling(text, runtime.useAttention !== false);
  text = normalizeClauseParticles(text);
  text = prepareReviewedContext(repairPhrases(text));
  text = extendedPhrases(text);
  text = expositoryPhrases(text);
  text = businessPhrases(text);
  text = technicalPhrases(text);
  if (!preserveFormatting) text = businessLayout(text);
  const lines = text.split('\n').flatMap(line => {
    if (preserveFormatting) return [line];
    return enumerate(line);
  });
  // Repeated nominal field labels are document structure, not sentences.
  const nonemptyLines = lines.filter(line => line.trim());
  const fieldLabelBlock = nonemptyLines.length >= 3 && nonemptyLines.every(line =>
    !/[.!?:;]|^(?:\s*[-*]|\s*\d+[.)])/u.test(line) && (line.match(/\p{L}+/gu)?.length ?? 0) <= 6)
    && nonemptyLines.filter(line => {
      const words = line.match(/\p{L}+/gu) ?? [];
      return words.length >= 2 && productiveMorphology.analyzeWord(words[0] ?? '').some(row => row.pos === 'noun' && row.features.case === 'genitive');
    }).length >= 2
    && nonemptyLines.filter(line => !(line.match(/\p{L}+/gu) ?? []).some(isFinitePredicate)).length / nonemptyLines.length >= 0.8;
  text = lines.map((line, index) => {
    if (fieldLabelBlock) return capitalize(line.trim());
    if (index > 0 && /^hörmətlə[,!.]?$/i.test(lines[index - 1].trim())) return capitalize(line.trim());
    if (line.includes(marker) && line.trim().startsWith(marker)) {
      const index = Number(line.trim().slice(marker.length).split('\uE001')[0]);
      if (protectedText[index]?.startsWith('`') && line.trim() === `${marker}${index}\uE001`) return line;
    }
    const list = line.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/);
    // A line that explicitly starts with a number is already an unambiguous
    // list item, including when each item was entered on a separate line.
    const normalizedPrefix = list?.[1].replace(/^(\s*\d+)[.)]\s+$/, '$1. ');
    if (list) {
      let item = punctuate(list[2], runtime.useLocalModel !== false, runtime);
      // All-caps technical list items (for example "API") are headings only
      // outside lists; inside a list they still need terminal punctuation.
      if (!/[.!?:;…]["”»)]?$/u.test(item)) item += '.';
      return normalizedPrefix! + item;
    }
    return punctuate(line, runtime.useLocalModel !== false, runtime);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!preserveFormatting) {
    text = businessStageLists(text);
    text = narrativeParagraphs(text);
    text = text.replace(/([.!?]) +(?=(?:Bundan əlavə|Digər tərəfdən|Nəticə olaraq)(?:\s|$))/g, '$1\n\n');
    if (!/\n\s*\n/u.test(input)) text = segmentParagraphs(text);
  }
  if (runtime.useLocalModel !== false) text = neuralAgreement(text);
  text = text.split(marker).map((part, index) => {
    if (!index) return part;
    const end = part.indexOf('\uE001');
    return end < 0 ? marker + part : protectedText[Number(part.slice(0, end))] + part.slice(end + 1);
  }).join('');
  // "gul" is otherwise ambiguous; a flower laid at the martyrs' memorial is unambiguous.
  text = text.replace(/(Şəhidlər xiyabanında\s+)gul(?=\s+qoyduq(?:$|[^\p{L}]))/giu, '$1gül');
  // Numeric values are protected during lexical correction, so attach
  // Azerbaijani case suffixes only after restoring the protected span.
  text = text
    .replace(/(\d{1,2}:\d{2})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d+(?:\.\d+){1,3})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d{1,2})\s+(e|ə)(?=$|[^\p{L}])/giu, '$1-ə');
  // Word/punctuation change estimate via common prefix/suffix; never advertised
  // as a linguistic error count. This is linear even for 10k-character inputs.
  const before = input.match(/\S+/g) ?? [];
  const after = text.match(/\S+/g) ?? [];
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(before.length, after.length) - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return { text, corrections: input === text ? 0 : Math.max(1, Math.max(before.length, after.length) - prefix - suffix) };
}

export function formatEmail(input: string, options: { emailGreeting?: string; omitSubject?: boolean } = {}): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  // The dropdown owns the salutation. Remove the same salutation from a pasted
  // draft so it does not leak into the body as an unpunctuated second greeting.
  const draft = isEmailGreeting(options.emailGreeting)
    ? input.replace(/^(?:salam[,!?.]?\s*)?(?:h[eə]r\s+vaxt[iı]n[iı]z\s+xeyir[.!?,]?)(?=\s|$)/iu, '').trim()
    : input;
  const document = parseEmailSections(draft);
  const subject = document.subject
    ? correctText(document.subject, true).text.replace(/[.!?]+$/u, '')
      .replace(/\babb\b/giu, 'ABB').replace(/\b(?:it|İt)\b/gu, 'IT')
      .replace(/\b(?:sla|Sla)\b/gu, 'SLA').replace(/\b(?:hr|Hr)\b/gu, 'HR')
    : 'Müraciət';
  const greeting = isEmailGreeting(options.emailGreeting) ? options.emailGreeting : document.salutation?.type === 'honorific'
    ? correctText(`Hörmətli ${document.salutation.addressee}`, true).text
      .replace(/[,.!?]+$/u, '')
      .replace(/^(Hörmətli\s+)(\p{L}+)(\s+(?:xanım|bəy))$/iu,
        (_, title: string, name: string, suffix: string) => title + name[0].toLocaleUpperCase('az-AZ') + name.slice(1) + suffix) + ','
    : 'Salam,';
  // A compact draft needs the same sentence and paragraph segmentation as
  // prose; explicit user line breaks still take priority in a structured mail.
  const preparedBody = document.body;
  let body = preparedBody ? correctText(prepareEmailBody(preparedBody), /\n/u.test(preparedBody)).text : '';
  if (body) {
    const inferred = prepareEmailBody(body);
    if (inferred !== body) body = correctText(inferred, true).text;
    if (!/\n/u.test(document.body)) body = paragraphEmailBody(segmentParagraphs(body));
  }
  // Names and job titles are structural signature text, never prose: preserve
  // their line breaks and never add sentence-ending punctuation to them.
  const signature = document.signature?.split('\n').map(line => line.trim()
    .replace(/^layihe(?=\s+komandasi\b)/iu, 'Layihə')
    .replace(/^destek(?=\s+komandasi\b)/iu, 'Dəstək')
    .replace(/^(\p{L}+)\s+(\p{L}+)\s+(?=(?:biznes analitik|backend engineer|frontend engineer|software engineer|sistem analitiki|layihə meneceri|məhsul sahibi)\b)/iu,
      (_, first: string, last: string) =>
        first[0].toLocaleUpperCase('az-AZ') + first.slice(1) + ' '
        + last[0].toLocaleUpperCase('az-AZ') + last.slice(1) + ' ')
    .replace(/\p{L}+/gu,
    word => resolveEntityWord(word, true, false) ?? (/^komandasi$/iu.test(word) ? 'komandası' : word)).replace(/^(\p{L})/u,
    letter => letter.toLocaleUpperCase('az-AZ'))).join('\n');
  const text = [options.omitSubject ? '' : `Mövzu: ${subject}`, greeting, body,
    signature ? `${document.closing ?? 'Hörmətlə,'}\n${signature}` : document.closing ?? 'Hörmətlə,'].filter(Boolean).join('\n\n');
  return { text, corrections: text === input ? 0 : 1 };
}
