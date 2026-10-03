/** Initials are part of a proper name, never independent sentence endings. */
export function protectInitialNames(text: string, protect: (value: string) => string): string {
  return text.replace(/(?<![\p{L}\p{N}])(?:\p{Lu}\. ?){1,3}\p{Lu}\p{Ll}{2,}(?:[-’'][\p{L}]+)?/gu, protect);
}

/** Preserve initial-name spans during a structural punctuation pass. */
export function withProtectedInitialNames(text: string, transform: (value: string) => string): string {
  let marker = '\uE000';
  while (text.includes(marker)) marker += '\uE000';
  const names: string[] = [];
  const shielded = protectInitialNames(text, value => `${marker}${names.push(value) - 1}\uE001`);
  return transform(shielded).replace(new RegExp(`${marker}(\\d+)\uE001`, 'gu'),
    (original, index: string) => names[Number(index)] ?? original);
}
