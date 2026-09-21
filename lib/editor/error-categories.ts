export const ERROR_CATEGORIES = [
  'typo',
  'diacritic',
  'morphology',
  'context',
  'punctuation',
  'technical',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  typo: 'Yazılış / typo',
  diacritic: 'Diakritik',
  morphology: 'Morfologiya',
  context: 'Kontekst',
  punctuation: 'Durğu və format',
  technical: 'Texniki terminologiya',
};

const ERROR_CATEGORY_SET = new Set<string>(ERROR_CATEGORIES);

export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === 'string' && ERROR_CATEGORY_SET.has(value);
}
