/** Portable evaluation data only. Never used as a runtime correction lookup. */
export interface ReviewCase {
  id: string;
  module: 'text' | 'mail';
  input: string;
  actual: string;
  expected: string;
  preserveFormatting: boolean;
  greeting?: string;
  reviewedAt: string;
  /** A user explicitly saved this target; not independent linguistic certification. */
  reviewStatus?: 'user-approved';
}
export interface ReviewCorpus {
  kind: 'slothai-reviewed-tests';
  version: 1;
  cases: ReviewCase[];
}
export const REVIEW_FILE_NAME = 'slothai-reviewed-tests.json';
export const MAX_REVIEW_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CASES = 5000;
export const emptyReviewCorpus = (): ReviewCorpus => ({ kind: 'slothai-reviewed-tests', version: 1, cases: [] });

function validCase(value: unknown): value is ReviewCase {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 150
    && (row.module === 'text' || row.module === 'mail')
    && typeof row.input === 'string' && row.input.trim().length > 0 && row.input.length <= 10000
    && typeof row.expected === 'string' && row.expected.trim().length > 0 && row.expected.length <= 10000
    && typeof row.actual === 'string' && row.actual.length <= 50000
    && typeof row.preserveFormatting === 'boolean'
    && (row.greeting === undefined || typeof row.greeting === 'string' && row.greeting.length <= 100)
    && (row.reviewStatus === undefined || row.reviewStatus === 'user-approved')
    && typeof row.reviewedAt === 'string' && Number.isFinite(Date.parse(row.reviewedAt));
}
export function parseReviewCorpus(text: string): ReviewCorpus {
  if (new Blob([text]).size > MAX_REVIEW_FILE_BYTES) throw new Error('Test faylı 25 MB həddini keçir.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Test faylı düzgün JSON deyil. Mövcud fayl dəyişdirilmədi.'); }
  if (!value || typeof value !== 'object') throw new Error('SlothAI test faylını seçin.');
  const data = value as Record<string, unknown>;
  if (data.kind !== 'slothai-reviewed-tests' || data.version !== 1 || !Array.isArray(data.cases)
    || data.cases.length > MAX_CASES || !data.cases.every(validCase)
    || new Set(data.cases.map(row => row.id)).size !== data.cases.length) {
    throw new Error('Test faylının formatı uyğun deyil. Mövcud fayl dəyişdirilmədi.');
  }
  return { kind: 'slothai-reviewed-tests', version: 1, cases: data.cases };
}
function sameSource(left: ReviewCase, right: ReviewCase): boolean {
  return left.module === right.module && left.input === right.input
    && left.preserveFormatting === right.preserveFormatting && left.greeting === right.greeting;
}
export function appendReviewCase(corpus: ReviewCorpus, row: ReviewCase): ReviewCorpus {
  if (!validCase(row)) throw new Error('Test nümunəsinin mətni və ya düzgün nəticəsi uyğun deyil.');
  const existing = corpus.cases.find(item => sameSource(item, row));
  const cases = existing ? corpus.cases.map(item => item === existing ? { ...row, id: existing.id } : item)
    : [...corpus.cases, row];
  if (cases.length > MAX_CASES) throw new Error('Faylda 5000 nümunə var. Yeni test faylı yaradın.');
  const next: ReviewCorpus = { kind: 'slothai-reviewed-tests', version: 1, cases };
  if (new Blob([serializeReviewCorpus(next)]).size > MAX_REVIEW_FILE_BYTES) throw new Error('Test faylı 25 MB həddini keçir. Yeni fayl yaradın.');
  return next;
}
export function serializeReviewCorpus(corpus: ReviewCorpus): string { return JSON.stringify(corpus, null, 2) + '\n'; }
