import { isDiscourseTransition } from './punctuation';

const stopwords = new Set('mən sən o biz siz onlar bu həmin bir və ya ilə üçün da də isə ki də buna görə olan olaraq daha sonra çox necə var idi oldu belə bütün hər həmin kimi'.split(' '));
const temporal = /^(?:səhər|günorta(?:dan sonra)?|axşam|gecə|ertəsi gün|sabah|bir neçə saat sonra|daha sonra)(?!\p{L})/iu;
const technical = /(?:server|api|sistem|request|backend|frontend|kod|proqram|database|verilənlər)/iu;
const business = /(?:müştəri|müqavilə|sənəd|təklif|hesabat|ödəniş|layihə)/iu;

function contentWords(sentence: string): Set<string> {
  const words = sentence.toLocaleLowerCase('az-AZ').match(/\p{L}{4,}/gu) ?? [];
  return new Set(words.filter(word => !stopwords.has(word)).map(word => word.replace(/(?:ların|lərin|ları|ləri|lardan|lərdən|lardan|lərdən|ının|inin|unun|ünün|lar|lər|dan|dən|nın|nin|nə|na|da|də)$/u, '')));
}

function differentTopics(a: string, b: string): boolean {
  if ((technical.test(a) && business.test(b) && !technical.test(b)) ||
    (business.test(a) && technical.test(b) && !business.test(b))) return true;
  const first = contentWords(a);
  const second = contentWords(b);
  if (first.size < 3 || second.size < 3) return false;
  let common = 0;
  for (const word of first) if (second.has(word)) common++;
  return common === 0;
}

/** Conservative local score; existing line breaks and list structure take priority. */
export function segmentParagraphs(text: string): string {
  return text.split(/(\n+)/u).map(part => {
    if (!part || part.includes('\n') || /^\s*(?:[-*]|\d+[.)]|#|```|<)/u.test(part)) return part;
    const sentences = part.match(/(?:[^.!?]|\d\.\d|\uE000+\d+\uE001)+[.!?]+(?:[”"»)]|$)?/gu);
    if (!sentences || sentences.length < 3) return part;
    let paragraphCount = 0;
    let output = '';
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      if (i === 0) { output = sentence; paragraphCount = 1; continue; }
      const previous = sentences[i - 1].trim();
      let score = 0;
      if (temporal.test(sentence)) score += 2;
      if (isDiscourseTransition(sentence)) score += 2;
      if (differentTopics(previous, sentence)) score += 1;
      if (paragraphCount >= 3) score += 1;
      if (paragraphCount >= 6) score += 1;
      const boundary = score >= 3 && (sentences.length >= 4 || paragraphCount >= 2);
      output += (boundary ? '\n\n' : ' ') + sentence;
      paragraphCount = boundary ? 1 : paragraphCount + 1;
    }
    return output;
  }).join('');
}
