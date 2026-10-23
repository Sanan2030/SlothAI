/** Structural passes must never interpret dots or question marks inside URLs,
 * email addresses or code as sentence boundaries. All processing is offline. */
export function codePattern(): RegExp {
  return /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|(`{1,2})(?!`)[^\n]*?\1|`[^`\n]*(?=\n|$)/gu;
}

export function literalPattern(): RegExp {
  return new RegExp(codePattern().source + '|' + /https?:\/\/[^\s<>`]+|(?<![\w.+-])[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\b(?:www\.[^\s<>`]+|[\w-]+\.(?:com|org|net|az)(?:[/?#][^\s<>`]*)?)/.source, 'giu');
}

/** Hide code from structural parsers too. Inline-code tokens are short enough
 * not to inflate normal bounded inputs and remain opaque to nested correction. */
export function withProtectedCode(text: string, transform: (value: string) => string): string {
  if (!codePattern().test(text)) return transform(text);
  const saved = new Map<string, string>();
  const used = new Set(text);
  let point = 0xE000;
  const value = text.replace(codePattern(), raw => {
    if (raw.length < 3) return raw;
    while (used.has(String.fromCharCode(point))) {
      point++;
      if (point === 0xF900) point = 0x4E00;
    }
    const character = String.fromCharCode(point);
    used.add(character);
    const token = '`' + character + '`'; saved.set(token, raw); return token;
  });
  return transform(value).replace(/`[^`\n]`/gu, token => saved.get(token) ?? token);
}

export function protectLiteralSpans(text: string, shield: (value: string) => string): string {
  return text.replace(literalPattern(), raw => {
    if (raw.startsWith('`') || raw.startsWith('~~~')) return shield(raw);
    const punctuation = raw.match(/[.,!?;:]+$/u)?.[0] ?? '';
    return shield(punctuation ? raw.slice(0, -punctuation.length) : raw) + punctuation;
  });
}

export function withProtectedLiterals(text: string, transform: (value: string) => string): string {
  let marker = '\uE000';
  while (text.includes(marker)) marker += '\uE000';
  const literals: string[] = [];
  const shield = (value: string) => `${marker}${literals.push(value) - 1}\uE001`;
  const value = protectLiteralSpans(text, shield);
  return transform(value).replace(new RegExp(`${marker}(\\d+)\uE001`, 'gu'), (raw, index: string) => literals[Number(index)] ?? raw);
}
