/** Parse mail structure before passing body prose to the local editor. */
export interface EmailDocument {
  subject?: string;
  salutation?: { type: 'hello' | 'honorific'; addressee?: string };
  body: string;
  closing?: string;
  signature?: string;
}

/** Extra clause cues for dense mail drafts; existing paragraph breaks win. */
export function prepareEmailBody(body: string): string {
  return body.split('\n').map(line => line
    .replace(/(?<![.!?])\b(deyil|mümkün deyil|mümkündür|hazırdır|olunub|olmalıdır|göndərildi|göndərin|baxıldı|aparıldı|təsdiqləndi|tesdiqlendi)\s+(?=(?:bu|növbəti|əlavə|lakin|bununla|əgər|sənəd|sened|müraciət|muraciet|sistem|komanda|iş|is)\s)/giu, '$1. ')
    .replace(/(?<![.!?])\b(göndəriləcək|gonderilecek|göndərildi|işləyir|isleyir|yoxladıq|yoxladiq|edilmir|baxılmalıdır|baxilmalidir|etdik|çatışmır|catismir|bilmirik|məlumdur|melumdur|deyil)\s+(?=(?:zəhmət|zehmet|xahiş|xahis|bu gün|bugun|səbəbi|sebebi|birinci|ikinci|üçüncü|ucuncu|UAT\s+üçün|uat\s+ucun)\b)/giu, '$1. ')
    .replace(/(?<![,;.!?])\b(varsa|olsa)\s+(?=(?:müraciət|muraciet|sənəd|sened|bizimlə|bizimle|xahiş|xahis)\b)/giu, '$1, ')
  ).join('\n');
}

// Recipient titles identify the end of a compact salutation. These are
// addressee nouns, never an inventory of possible body-opening phrases.
const recipientEnd = /(?:bəy|bey|xanım|xanim|komanda(?:sı|si)?|hemkarlar|həmkarlar|terefdaslar|tərəfdaşlar|terefdasimiz|tərəfdaşımız|musteri|müştəri|nümayəndəsi|numayendesi|istifadecisi|istifadəçisi|istifadeciler|istifadəçilər|analitikler|analitiklər|şəxslər|sexsler|heyəti|heyeti|rəhbərlik|rehberlik|əməkdaşlar|emekdaslar|komitəsi|komitesi|tərəflər|terefler)(?=[,!.\s]|$)/iu;

export function parseEmailSections(input: string): EmailDocument {
  let remaining = input.replace(/\r\n?/gu, '\n').trim();
  let subject: string | undefined;
  const explicit = remaining.match(/^(?:movzu|mövzu):?\s*([^\n]*?)(?=\s+(?:salam|hormetli|hörmətli)\b|\n|$)/iu);
  if (explicit) {
    subject = explicit[1].trim();
    remaining = remaining.slice(explicit[0].length).trim();
  } else {
    const greetingAt = remaining.match(/\s+(?=(?:salam|hormetli|hörmətli)\b)/iu);
    if (greetingAt?.index && !/^(?:salam|hormetli|hörmətli)(?=\s|$)/iu.test(remaining)
      && !remaining.slice(0, greetingAt.index).includes('\n')) {
      subject = remaining.slice(0, greetingAt.index).trim();
      remaining = remaining.slice(greetingAt.index).trim();
    }
  }

  let closing: string | undefined;
  let signature: string | undefined;
  const farewell = [...remaining.matchAll(/(?:^|\s)(?:hörmətlə|hormetle|təşəkkürlə|tesekkurle)[,.]?(?=\s|$)/giu)].at(-1);
  if (farewell?.index !== undefined) {
    const tail = remaining.slice(farewell.index + farewell[0].length).trim();
    if (tail.length <= 240) {
      signature = tail || undefined;
      closing = /təşəkkürlə|tesekkurle/iu.test(farewell[0]) ? 'Təşəkkürlə,' : 'Hörmətlə,';
      remaining = remaining.slice(0, farewell.index).trim();
    }
  }

  let salutation: EmailDocument['salutation'];
  const hello = remaining.match(/^salam[,!.]?(?=\s|$)/iu);
  if (hello) {
    salutation = { type: 'hello' };
    remaining = remaining.slice(hello[0].length).trim();
    const titled = remaining.match(/^((?:\p{L}+(?:\s+\p{L}+)?\s+)?(?:bəy|bey|xanım|xanim))[,!.]?(?=\s|$)/iu);
    if (titled) {
      salutation = { type: 'honorific', addressee: titled[1] };
      remaining = remaining.slice(titled[0].length).trim();
    }
  }
  if (!salutation || /^(?:hörmətli|hormetli)\s+/iu.test(remaining)) {
    const honorific = remaining.match(/^(?:hörmətli|hormetli)\s+/iu);
    if (honorific) {
      const following = remaining.slice(honorific[0].length);
      const first = following.split('\n')[0];
      const titled = first.match(/^(.*?\b(?:bəy|bey|xanım|xanim))[,!.]?(?=\s|$)/iu);
      const comma = first.match(/^([^,!.]+)[,!.](?=\s|$)/u);
      const recipient = titled ?? comma ?? (() => {
        const words = [...first.matchAll(/\p{L}+/gu)];
        const end = words.findLastIndex((item, index) => index < 9 && recipientEnd.test(item[0]));
        if (end < 0) return undefined;
        const span = first.slice(0, words[end].index! + words[end][0].length);
        return [span, span];
      })();
      if (recipient) {
        salutation = { type: 'honorific', addressee: recipient[1].trim() };
        remaining = following.slice(recipient[0].length).replace(/^[,!.\s]+/u, '').trim();
      }
    }
  }
  return { subject, salutation, body: remaining, closing, signature };
}
