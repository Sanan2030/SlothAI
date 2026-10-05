/** Structural passes must never interpret dots or question marks inside URLs,
 * email addresses or code as sentence boundaries. All processing is offline. */
export function withProtectedLiterals(text: string, transform: (value: string) => string): string {
  let marker = '\uE000';
  while (text.includes(marker)) marker += '\uE000';
  const literals: string[] = [];
  const shield = (value: string) => `${marker}${literals.push(value) - 1}\uE001`;
  const value = text.replace(/```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|(?<![\w.+-])[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\bwww\.[^\s<>]+/gu, raw => {
    if (raw.startsWith('`')) return shield(raw);
    const punctuation = raw.match(/[.,!?;:]+$/u)?.[0] ?? '';
    return shield(punctuation ? raw.slice(0, -punctuation.length) : raw) + punctuation;
  });
  return transform(value).replace(new RegExp(`${marker}(\\d+)\uE001`, 'gu'), (raw, index: string) => literals[Number(index)] ?? raw);
}
