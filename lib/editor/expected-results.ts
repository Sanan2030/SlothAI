/** User-approved full examples. Exact input matches are replayed; safe word edits can be reused separately. */
export interface ExpectedResult {
  module: 'text' | 'mail';
  input: string;
  output: string;
  preserveFormatting: boolean;
}

export const EXPECTED_RESULTS_KEY = 'slothai-expected-results-v1';
const MAX_EXAMPLES = 30;
const MAX_LENGTH = 10_000;
const sameInput = (value: string) => value.trim().replace(/[\t ]+/gu, ' ');

function valid(value: unknown): value is ExpectedResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.module === 'text' || item.module === 'mail')
    && typeof item.input === 'string' && item.input.length > 0 && item.input.length <= MAX_LENGTH
    && typeof item.output === 'string' && item.output.trim().length > 0 && item.output.length <= MAX_LENGTH
    && typeof item.preserveFormatting === 'boolean';
}

export function readExpectedResults(storage: Pick<Storage, 'getItem'>): ExpectedResult[] {
  try {
    const raw = storage.getItem(EXPECTED_RESULTS_KEY);
    if (!raw || raw.length > 650_000) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).slice(-MAX_EXAMPLES) : [];
  } catch { return []; }
}

export function findExpectedResult(items: readonly ExpectedResult[], query: Pick<ExpectedResult, 'module' | 'input' | 'preserveFormatting'>): ExpectedResult | undefined {
  return [...items].reverse().find(item => item.module === query.module
    && sameInput(item.input) === sameInput(query.input) && item.preserveFormatting === query.preserveFormatting);
}

export function saveExpectedResult(items: readonly ExpectedResult[], item: ExpectedResult): ExpectedResult[] {
  if (!valid(item)) throw new Error('Nümunədə mətn və ya düzgün nəticə boşdur, yaxud 10 000 simvolu keçir.');
  return [...items.filter(old => old.module !== item.module || sameInput(old.input) !== sameInput(item.input)
    || old.preserveFormatting !== item.preserveFormatting), item].slice(-MAX_EXAMPLES);
}

export function writeExpectedResults(storage: Pick<Storage, 'setItem'>, items: readonly ExpectedResult[]): boolean {
  try {
    storage.setItem(EXPECTED_RESULTS_KEY, JSON.stringify(items));
    return true;
  } catch { return false; }
}
