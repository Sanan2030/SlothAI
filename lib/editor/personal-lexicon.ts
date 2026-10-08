/** Explicitly confirmed, browser-only corrections. No document text is stored. */
export interface PersonalRule { source: string; target: string; left: string; right: string }
export interface PersonalLexicon { pending: PersonalRule[]; confirmed: PersonalRule[] }

export const PERSONAL_LEXICON_KEY = 'slothai-personal-lexicon-v1';
const MAX_RULES = 100;
const WORD = /\p{L}+(?:[-’']\p{L}+)*/gu;
const fold = (text: string) => text.toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu,
  value => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[value]!);
const empty = (): PersonalLexicon => ({ pending: [], confirmed: [] });

function tokens(text: string) {
  return [...text.matchAll(WORD)].map(match => ({ word: match[0], index: match.index! }));
}
function neighbors(text: string, words: ReturnType<typeof tokens>, index: number) {
  const before = words[index - 1];
  const after = words[index + 1];
  const current = words[index];
  return {
    left: before && !/[.!?\n]/u.test(text.slice(before.index + before.word.length, current.index)) ? fold(before.word) : '',
    right: after && !/[.!?\n]/u.test(text.slice(current.index + current.word.length, after.index)) ? fold(after.word) : '',
  };
}
function key(rule: PersonalRule) { return `${rule.source.toLocaleLowerCase('az-AZ')}\0${rule.target}\0${rule.left}\0${rule.right}`; }
function contextKey(rule: PersonalRule) { return `${rule.source.toLocaleLowerCase('az-AZ')}\0${rule.left}\0${rule.right}`; }

/** Accept only one-to-one word edits; paragraph rewrites cannot silently teach the dictionary. */
export function extractPersonalCandidates(original: string, edited: string): PersonalRule[] {
  const before = tokens(original), after = tokens(edited);
  if (before.length !== after.length || before.length > 1500) return [];
  const changes: PersonalRule[] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i].word === after[i].word) continue;
    const source = before[i].word, target = after[i].word;
    if (source.length < 2 || target.length < 2 || source.length > 40 || target.length > 40) return [];
    const context = neighbors(original, before, i);
    // If several token positions shifted, the unchanged neighbors will disagree.
    if (before.length > 1 && ![before[i - 1]?.word === after[i - 1]?.word,
      before[i + 1]?.word === after[i + 1]?.word].some(Boolean)) return [];
    changes.push({ source, target, ...context });
    if (changes.length > 5) return [];
  }
  return changes;
}

export function queuePersonalCandidates(state: PersonalLexicon, candidates: readonly PersonalRule[]): PersonalLexicon {
  const existing = new Set([...state.pending, ...state.confirmed].map(key));
  const pending = [...state.pending];
  for (const rule of candidates) {
    if (existing.has(key(rule))) continue;
    pending.push(rule);
    existing.add(key(rule));
  }
  return { pending: pending.slice(-MAX_RULES), confirmed: state.confirmed };
}

export function confirmPersonalCandidate(state: PersonalLexicon, rule: PersonalRule): PersonalLexicon {
  return { pending: state.pending.filter(item => contextKey(item) !== contextKey(rule)),
    confirmed: [...state.confirmed.filter(item => contextKey(item) !== contextKey(rule)), rule].slice(-MAX_RULES) };
}

export function dismissPersonalCandidate(state: PersonalLexicon, rule: PersonalRule): PersonalLexicon {
  return { ...state, pending: state.pending.filter(item => key(item) !== key(rule)) };
}

export function applyPersonalLexicon(text: string, rules: readonly PersonalRule[]): string {
  if (!rules.length) return text;
  const words = tokens(text);
  const protectedRanges = [...text.matchAll(/<!--[\s\S]*?-->|```[\s\S]*?(?:```|$)|`[^`\n]*`|<\/?[A-Za-z][^<>\n]*>|https?:\/\/[^\s<>]+|(?<![\w.+-])[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/gu)]
    .map(match => ({ start: match.index!, end: match.index! + match[0].length }));
  let protectedIndex = 0;
  let output = '';
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    while (protectedRanges[protectedIndex]?.end <= current.index) protectedIndex++;
    if (protectedRanges[protectedIndex]?.start <= current.index
      && current.index < protectedRanges[protectedIndex].end) continue;
    const context = neighbors(text, words, i);
    const rule = rules.find(item => item.source.toLocaleLowerCase('az-AZ') === current.word.toLocaleLowerCase('az-AZ')
      && ((item.left || item.right) ? (!item.left || item.left === context.left)
        && (!item.right || item.right === context.right) : words.length === 1));
    if (!rule) continue;
    output += text.slice(cursor, current.index) + (/^\p{Lu}/u.test(current.word)
      ? rule.target[0].toLocaleUpperCase('az-AZ') + rule.target.slice(1) : rule.target);
    cursor = current.index + current.word.length;
  }
  return output + text.slice(cursor);
}

function validRule(value: unknown): value is PersonalRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  return typeof rule.source === 'string' && typeof rule.target === 'string'
    && typeof rule.left === 'string' && typeof rule.right === 'string'
    && rule.source.length <= 40 && rule.target.length <= 40
    && rule.left.length <= 40 && rule.right.length <= 40
    && /^\p{L}+(?:[-’']\p{L}+)*$/u.test(rule.source)
    && /^\p{L}+(?:[-’']\p{L}+)*$/u.test(rule.target);
}

export function readPersonalLexicon(storage: Pick<Storage, 'getItem'>): PersonalLexicon {
  try {
    const raw = storage.getItem(PERSONAL_LEXICON_KEY);
    if (!raw || raw.length > 40_000) return empty();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return empty();
    const value = data as Record<string, unknown>;
    return { pending: Array.isArray(value.pending) ? value.pending.filter(validRule).slice(-MAX_RULES) : [],
      confirmed: Array.isArray(value.confirmed) ? value.confirmed.filter(validRule).slice(-MAX_RULES) : [] };
  } catch { return empty(); }
}

export function writePersonalLexicon(storage: Pick<Storage, 'setItem'>, state: PersonalLexicon): boolean {
  try {
    storage.setItem(PERSONAL_LEXICON_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}
