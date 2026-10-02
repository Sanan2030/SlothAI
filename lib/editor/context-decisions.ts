import { productiveMorphology } from './productive-morphology';
/** Apply grammatical evidence before statistical guesses; unresolved alternatives abstain. */
export function preserveContextualHomographs(text: string, protect: (word: string) => string): string {
  return text.replace(/(?<!\p{L})ac(?!\p{L})/giu, (word, offset: number) => {
    const after = text.slice(offset + word.length).match(/^\s+(\p{L}+)/u)?.[1]?.toLocaleLowerCase('az-AZ');
    const before = text.slice(0, offset).match(/(\p{L}+)\s+$/u)?.[1]?.toLocaleLowerCase('az-AZ');
    const hunger = after && /^(?:idi|idim|idin|idik|idiniz|idilər|idisə|olduğu|olduğunu)$/u.test(after);
    const nominal = /^(?:mən|sən|o|biz|siz|onlar)$/u.test(before ?? '') && !after;
    return hunger || nominal ? protect(word) : word;
  });
}
export function normalizeClauseParticles(text: string): string {
  return text.replace(/(?<!\p{L})ise(?!\p{L})/giu, (word, offset: number) => {
    const previous = text.slice(0, offset).match(/(\p{L}+)\s+$/u)?.[1]?.toLocaleLowerCase('az-AZ') ?? '';
    const following = text.slice(offset + word.length).match(/^\s+(\p{L}+)/u)?.[1]?.toLocaleLowerCase('az-AZ') ?? '';
    // A motion verb licenses işə (dative), not the contrast particle isə.
    if (/^(?:get|ged|çat|başla)/u.test(following)) return word;
    const nominal = productiveMorphology.analyzeWord(previous).some(row => row.pos === 'noun');
    if (nominal || /^(?:mən|sən|o|biz|siz|onlar|sabah|dünən|indi|sonra)$/u.test(previous)) return /^\p{Lu}/u.test(word) ? 'İsə' : 'isə';
    return word;
  });
}
/** A causal transition starts a new clause only after a completed main predicate. */
export function segmentDiscourseClauses(text: string, finite: (word: string) => boolean): string {
  return text.replace(/(?<!\p{L})(\p{L}+) +(buna görə|bu səbəbdən) +([^.!?\n]+)/giu,
    (match, left: string, transition: string, rest: string, offset: number) => {
      const prefix = text.slice(0, offset).split(/[.!?\n]/u).at(-1) ?? '';
      if (!finite(left) || /(?:^|\s)(?:ki|əgər)(?=\s|$)/iu.test(prefix)) return match;
      const tokens = rest.match(/\p{L}+/gu)?.slice(0, 16) ?? [];
      return tokens.some(finite) ? left + '. ' + transition + ' ' + rest : match;
    });
}
