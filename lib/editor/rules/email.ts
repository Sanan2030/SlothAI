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
    .replace(/(?<![.!?])\b(göndəriləcək|gonderilecek|göndərildi|göndərdik|gonderdik|yaradıldı|yaradildi|işləyir|isleyir|yoxladıq|yoxladiq|edilmir|baxılmalıdır|baxilmalidir|yoxlanılmalıdır|yoxlanilmalidir|lazımdır|lazimdir|edilir|başlayır|baslayir|etdik|çatışmır|catismir|bilmirik|məlumdur|melumdur|deyil)\s+(?=(?:qeydiyyat|müştəri|musteri|biz|api|API|səbəbi|sebebi|səbəbin|sebebin|uat|UAT|zəhmət|zehmet|xahiş|xahis|bu gün|bugun|birinci|ikinci|üçüncü|ucuncu)\b)/giu, '$1. ')
    .replace(/(?<![.!?])\b(qalıb|dəyişməyib|görünmür|olunub|gördük|işləyir|qaytarır|yenilənib|əlavə olunub|bilmir|deyil|yaranır|çatıb|tamamlanıb|qəbul olunub|alınıb)\s+(?=(?:xahiş|zəhmət|problem|səbəb|nəticə|loglar|icazə|BPMN|UAT|staging|müştəri|sənəd|sorğu)\b)/giu, '$1. ')
    .replace(/(?<![.!?])\b(qaytarır|işləyir|gördük|olunub|yenilənib)\s+(?=(?:staging|logları|səbəbi|nəticə|BPMN|UAT)\b)/giu, '$1. ')
    .replace(/(?<![,;.!?])\b(varsa|olsa)\s+(?=(?:müraciət|muraciet|sənəd|sened|bizimlə|bizimle|xahiş|xahis)\b)/giu, '$1, ')
  ).join('\n');
}

/** Keep a dense draft readable without replacing paragraphs the author supplied. */
export function paragraphEmailBody(body: string): string {
  if (/\n/u.test(body) || body.length < 360) return body;
  const sentences = body.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
  if (sentences.length < 4) return body;
  const groups: string[] = [];
  let current: string[] = [];
  for (const sentence of sentences) {
    const boundary = current.length >= 2 && (
      current.join(' ').length >= 220
      || /^(?:Biz|Müştəri|API|UAT|Birinci|İkinci|Üçüncü|Növbəti|Bundan əlavə|Zəhmət)/u.test(sentence)
    );
    if (boundary) { groups.push(current.join(' ')); current = []; }
    current.push(sentence);
  }
  if (current.length) groups.push(current.join(' '));
  return groups.join('\n\n');
}

// Recipient titles identify the end of a compact salutation. These are
// addressee nouns, never an inventory of possible body-opening phrases.
const recipientEnd = /^(?:bəy|bey|xanım|xanim|komanda(?:sı|si)?|hemkarlar|həmkarlar|terefdaslar|tərəfdaşlar|terefdasimiz|tərəfdaşımız|musteri|müştəri|müştərilər|müraciətçi|nümayəndəsi|numayendesi|istifadecisi|istifadəçisi|istifadeciler|istifadəçilər|analitikler|analitiklər|analitikləri|şəxslər|sexsler|şəxs|heyəti|heyeti|heyət|rəhbər|rəhbəri|rəhbərləri|rəhbərlik|rehberlik|əməkdaşlar|emekdaslar|komitəsi|komitesi|tərəflər|terefler|qrupu|şöbəsi|sahibləri|sahibi|işçiləri|koordinatorları|mühəndislər|mühəndis|inzibatçılar|tərtibatçılar|operatorlar|operatorları|operator|mühasiblər|mühasibat|menecer|meneceri|təmsilçi|vendor|tərəfdaş|tərəfdaşı|hazırlayanlar|müəllifləri|icraçılar|icraçı|dəstək|dizaynerlər|mərkəzi|təlimçilər|katiblik|müdiri|iştirakçıları)$/iu;

function recipientFromLine(line: string): RegExpMatchArray | undefined {
  const words = [...line.matchAll(/\p{L}+/gu)];
  // A recipient may have several qualifiers ("filial texniki dəstək qrupu");
  // never scan the entire body looking for a convenient recipient noun.
  const end = words.findLastIndex((item, index) => index < 5 && recipientEnd.test(item[0]));
  if (end < 0) return undefined;
  const span = line.slice(0, words[end].index! + words[end][0].length);
  return [span, span] as unknown as RegExpMatchArray;
}

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
    } else {
      const recipient = recipientFromLine(remaining.split('\n')[0]);
      // "Salam mühəndis sənədi gətirir" is prose about an engineer,
      // not an address to that engineer. A bare occupational noun needs
      // explicit comma or an honorific to become a salutation.
      const ambiguousOccupation = recipient?.[1].toLocaleLowerCase('az-AZ') === 'mühəndis'
        && !/^[,!]/u.test(remaining.slice(recipient[0].length));
      if (recipient && !ambiguousOccupation) {
        salutation = { type: 'honorific', addressee: recipient[1] };
        remaining = remaining.slice(recipient[0].length).replace(/^[,!.\s]+/u, '').trim();
      }
    }
  }
  if (!salutation || /^(?:hörmətli|hormetli)\s+/iu.test(remaining)) {
    const honorific = remaining.match(/^(?:hörmətli|hormetli)\s+/iu);
    if (honorific) {
      const following = remaining.slice(honorific[0].length);
      const first = following.split('\n')[0];
      const titled = first.match(/^(.*?\b(?:bəy|bey|xanım|xanim))[,!.]?(?=\s|$)/iu);
      const comma = first.match(/^([^,!.]+)[,!.](?=\s|$)/u);
      const recipient = titled ?? comma ?? recipientFromLine(first);
      if (recipient) {
        salutation = { type: 'honorific', addressee: recipient[1].trim() };
        remaining = following.slice(recipient[0].length).replace(/^[,!.\s]+/u, '').trim();
      }
    }
  }
  return { subject, salutation, body: remaining, closing, signature };
}
