/** Closed grammatical paradigms must not be reinterpreted as open-class stems. */
const forms = new Set<string>();
for (const pronoun of ['mən', 'sən', 'biz', 'siz']) {
  forms.add(pronoun);
  for (const suffix of ['ə', 'i', 'də', 'dən']) forms.add(pronoun + suffix);
  forms.add(pronoun + (pronoun === 'mən' || pronoun === 'biz' ? 'im' : 'in'));
}
for (const [pronoun, oblique] of [['o', 'on'], ['bu', 'bun']] as const) {
  forms.add(pronoun);
  for (const suffix of ['un', 'a', 'u', 'da', 'dan']) forms.add(oblique + suffix);
  const plural = oblique + 'lar'; forms.add(plural);
  for (const suffix of ['ın', 'a', 'ı', 'da', 'dan']) forms.add(plural + suffix);
}
export const isClosedFunctionForm = (word: string): boolean => forms.has(word.toLocaleLowerCase('az-AZ'));
