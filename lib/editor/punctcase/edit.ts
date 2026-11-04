import { literalPattern } from '../literal-spans';
import info from './model-info.json';
import { PunctCaseModel, punctCaseLower, punctCaseWordPattern, tagProbabilities } from './core';

export interface PunctCaseStats {
  mode: 'experimental'; sourceCheckpointSHA256: string; loaded: boolean;
  tokens: number; proposed: number; applied: number; punctuation: number; capitalization: number;
  skippedLines: number; skippedReason?: string; rejectedUnstable: boolean; inferenceTimeMs: number;
}
export const initialPunctCaseStats = (): PunctCaseStats => ({ mode: 'experimental',
  sourceCheckpointSHA256: info.sourceCheckpointSHA256, loaded: false, tokens: 0, proposed: 0,
  applied: 0, punctuation: 0, capitalization: 0, skippedLines: 0, rejectedUnstable: false, inferenceTimeMs: 0 });

/** Fixed engineering guards, not fitted on a test set or real-error calibration data. */
export const PUNCTCASE_POLICY = Object.freeze({ punctuationProbability: 0.995, titleProbability: 0.95 });
const STRUCTURAL_MARKERS = ['<', '>', '`', '*', '_', '~', '#', '|', '\\', '[', ']', '{', '}'];
const hasStructuralMarkers = (text: string) => STRUCTURAL_MARKERS.some(marker => text.includes(marker));
export function punctCaseSkipReason(source: string): string | undefined {
  if (literalPattern().test(source)) return 'protected-document';
  if (hasStructuralMarkers(source) || /(?:^|\n)\s*(?:[-+]\s|\d+[.)]\s)/u.test(source)) return 'structured-document';
  if (/[,.;:!?…]/u.test(source)) return 'existing-punctuation';
  if ((source.match(punctCaseWordPattern())?.length ?? 0) < 4) return 'short-draft';
  return undefined;
}

/** Insert marks/capital initials only; preserve all source whitespace and existing punctuation. */
export function editWithPunctCase(text: string, model: Pick<PunctCaseModel, 'predict'>, stats: PunctCaseStats): string {
  const cache = new Map<string, Float32Array>();
  let signature = false;
  return text.split('\n').map(line => {
    if (/^\s*hörmətlə(?=[,\s.!?]|$)/iu.test(line)) signature = true;
    if (signature || line !== line.normalize('NFC') || /^\s*(?:Mövzu:|[-*+]\s|\d+[.)]\s|#{1,6}\s)/u.test(line)
      || hasStructuralMarkers(line) || /[\uE000-\uF8FF]/u.test(line)) { stats.skippedLines++; return line; }
    const matches = [...line.matchAll(punctCaseWordPattern())];
    if (matches.length < 4) { stats.skippedLines++; return line; }
    const ranges = [...line.matchAll(literalPattern())].map(match => [match.index!, match.index! + match[0].length]);
    for (const match of line.matchAll(/[\p{L}\p{N}_]+(?:[._/-][\p{L}\p{N}_]+)*/gu)) {
      if (/[\p{N}_]|[a-z][A-Z]/u.test(match[0]) || match[0].length > 1 && match[0] === match[0].toLocaleUpperCase('az-AZ')) {
        ranges.push([match.index!, match.index! + match[0].length]);
      }
    }
    const protectedWord = (at: number) => ranges.some(([left, right]) => matches[at].index! < right && matches[at].index! + matches[at][0].length > left);
    const edits: { start: number; end: number; value: string; kind: 'punctuation' | 'capitalization' }[] = [];
    for (let offset = 0; offset < matches.length; offset += info.config.maxSentenceTokens) {
      const chunk = matches.slice(offset, offset + info.config.maxSentenceTokens);
      const predicted = model.predict(chunk.map(word => word[0]), cache);
      stats.tokens += chunk.length;
      for (let at = 0; at < chunk.length - 1; at++) {
        const global = offset + at, current = chunk[at], next = chunk[at + 1];
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

export function samePunctCaseWords(left: string, right: string): boolean {
  const words = (text: string) => (text.match(punctCaseWordPattern()) ?? []).map(punctCaseLower);
  return JSON.stringify(words(left)) === JSON.stringify(words(right));
}
