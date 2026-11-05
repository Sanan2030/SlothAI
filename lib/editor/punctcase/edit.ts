import { literalPattern } from '../literal-spans';
import info from './model-info.json';
import { PunctCaseModel, punctCaseLower, punctCaseWordPattern, tagProbabilities } from './core';
import { editStructuredText } from '../structured-text';
import { editHTMLStructure } from '../html-structure';

export interface PunctCaseStats {
  mode: 'automatic'; sourceCheckpointSHA256: string; loaded: boolean;
  tokens: number; inferenceTokens: number; proposed: number; applied: number; punctuation: number; capitalization: number;
  skippedLines: number; skippedReason?: string; rejectedUnstable: boolean; inferenceTimeMs: number;
}
export const initialPunctCaseStats = (): PunctCaseStats => ({ mode: 'automatic',
  sourceCheckpointSHA256: info.sourceCheckpointSHA256, loaded: false, tokens: 0, proposed: 0,
  inferenceTokens: 0, applied: 0, punctuation: 0, capitalization: 0, skippedLines: 0, rejectedUnstable: false, inferenceTimeMs: 0 });

/** Fixed engineering guards, not fitted on a test set or real-error calibration data. */
export const PUNCTCASE_POLICY = Object.freeze({ punctuationProbability: 0.995, titleProbability: 0.95 });
const STRUCTURAL_MARKERS = ['<', '>', '`', '*', '_', '~', '#', '|', '\\', '[', ']', '{', '}'];
const hasStructuralMarkers = (text: string) => STRUCTURAL_MARKERS.some(marker => text.includes(marker));

/** Insert marks/capital initials only; preserve all source whitespace and existing punctuation. */
export function editWithPunctCase(text: string, model: Pick<PunctCaseModel, 'predict'>, stats: PunctCaseStats,
  cache = new Map<string, Float32Array>()): string {
  let signature = false;
  return text.split('\n').map(line => {
    if (/^\s*hörmətlə(?=[,\s.!?]|$)/iu.test(line)) signature = true;
    if (signature || line !== line.normalize('NFC') || /^\s*(?:Mövzu:|[-*+]\s|\d+[.)]\s|#{1,6}\s)/u.test(line)
      || hasStructuralMarkers(line) || /[\uE000-\uF8FF]/u.test(line)) { stats.skippedLines++; return line; }
    const matches = [...line.matchAll(punctCaseWordPattern())];
    if (!matches.length) { stats.skippedLines++; return line; }
    const ranges = [...line.matchAll(literalPattern())].map(match => [match.index!, match.index! + match[0].length]);
    for (const match of line.matchAll(/[\p{L}\p{N}_]+(?:[._/-][\p{L}\p{N}_]+)*/gu)) {
      if (/[\p{N}_]|[a-z][A-Z]/u.test(match[0]) || match[0].length > 1 && match[0] === match[0].toLocaleUpperCase('az-AZ')) {
        ranges.push([match.index!, match.index! + match[0].length]);
      }
    }
    const protectedWord = (at: number) => ranges.some(([left, right]) => matches[at].index! < right && matches[at].index! + matches[at][0].length > left);
    const edits: { start: number; end: number; value: string; kind: 'punctuation' | 'capitalization' }[] = [];
    // Overlapping trained-size windows cover every gap once. Eight context
    // tokens on each side avoid leaving every 96th gap permanently unscored.
    const context = matches.length > info.config.maxSentenceTokens ? 8 : 0;
    const stride = info.config.maxSentenceTokens - context * 2;
    for (let offset = 0; offset < matches.length; offset += stride) {
      const start = Math.max(0, offset-context);
      const chunk = matches.slice(start, Math.min(matches.length, offset+stride+context));
      const predicted = model.predict(chunk.map(word => word[0]), cache);
      stats.tokens += Math.min(stride, matches.length-offset); stats.inferenceTokens += chunk.length;
      for (let global = offset; global < Math.min(offset+stride,matches.length-1); global++) {
        const at = global-start, current = chunk[at], next = chunk[at + 1];
        if (protectedWord(global) || protectedWord(global + 1)) continue;
        const end = current.index! + current[0].length, gap = line.slice(end, next.index!);
        if (!/^[\t ]+$/u.test(gap)) continue;
        const probability = tagProbabilities(predicted.punctuation[at]);
        const label = probability.indexOf(Math.max(...probability));
        if (!label || probability[label] < PUNCTCASE_POLICY.punctuationProbability) continue;
        const mark = info.punctuation[label];
        const nextCase = tagProbabilities(predicted.case[at + 1]);
        const terminal = /[.!?]/u.test(mark);
        if (terminal && nextCase[1] < PUNCTCASE_POLICY.titleProbability) continue;
        edits.push({ start: end, end, value: mark, kind: 'punctuation' });
        if (terminal && /^[a-zəçğıöşü]{2,}$/u.test(next[0])) {
          const initial = next[0][0].toLocaleUpperCase('az-AZ');
          edits.push({ start: next.index!, end: next.index! + 1, value: initial, kind: 'capitalization' });
        }
      }
    }
    stats.proposed += edits.length;
    let output = line;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
      stats[edit.kind]++; stats.applied++;
    }
    return output;
  }).join('\n');
}

/** Apply the complete checkpoint to editable prose. Existing structural scanners
 * keep fences, HTML attributes, link destinations and block prefixes opaque. */
export function editPunctCaseDocument(text: string, model: Pick<PunctCaseModel, 'predict'>, stats: PunctCaseStats): string {
  const cache = new Map<string, Float32Array>();
  let signature = false;
  const prose = (value: string): string => value.split(/(\r?\n)/u).map((line, at) => {
    if (at % 2) return line;
    if (/^[\s*_]*(?:hörmətlə|təşəkkürlə)[,.]?[\s*_]*$/iu.test(line)) signature = true;
    if (signature || line !== line.normalize('NFC') || /^\s*Mövzu:/iu.test(line)) { stats.skippedLines++; return line; }
    const ranges = [...line.matchAll(literalPattern())].map(match => [match.index!, match.index!+match[0].length]);
    for (const match of line.matchAll(/!?\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)|[\p{L}\p{N}_]+(?:[._/-][\p{L}\p{N}_]+)*|[*_~#|\\\[\]{}<>]+|[\uE000-\uF8FF]+/gu)) {
      const word = match[0];
      if (/^!?\[/u.test(word) || /[\p{N}_]|[a-z][A-Z]|[*~#|\\\[\]{}<>\uE000-\uF8FF]/u.test(word)
        || word.length > 1 && word === word.toLocaleUpperCase('az-AZ')) ranges.push([match.index!, match.index!+word.length]);
    }
    ranges.sort((a,b) => a[0]-b[0]);
    const edit = (part: string) => part.replace(/[^.!?;]+(?:[.!?;]+|$)/gu,
      sentence => editWithPunctCase(sentence, model, stats, cache));
    let result = '', cursor = 0;
    for (const [left,right] of ranges) {
      if (right <= cursor) continue;
      if (left > cursor) result += edit(line.slice(cursor,left));
      result += line.slice(Math.max(left,cursor),right); cursor = right;
    }
    return result+edit(line.slice(cursor));
  }).join('');
  const fragment = (value: string) => editHTMLStructure(value, prose) ?? prose(value);
  return editStructuredText(text, fragment, true) ?? editHTMLStructure(text, prose) ?? prose(text);
}

export function samePunctCaseWords(left: string, right: string): boolean {
  const words = (text: string) => (text.match(punctCaseWordPattern()) ?? []).map(punctCaseLower);
  return JSON.stringify(words(left)) === JSON.stringify(words(right));
}
