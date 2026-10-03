import { givenNames } from './entities/person-names';
import { places } from './entities/geo';
/** Clause-aware boundaries shared by ordinary text and email body processing. */
import { legacyModelMorphology as productiveMorphology } from './productive-morphology';
import { detectQuestion } from './punctuation';
import { isFinitePredicate, continuesConverb } from './segmentation';

const names = new Set([...givenNames, ...places].map(word => word.toLocaleLowerCase('az-AZ')));
const connectors = new Set(['və', 'ilə', 'ki', 'çünki', 'amma', 'lakin', 'halbuki', 'isə', 'da', 'də', 'üçün', 'kimi', 'olaraq']);
const openers = new Set([
  'lütfən', 'onu', 'onları', 'bunu', 'bunları', 'bunun', 'sizə', 'bizə', 'yenisi', 'yenisini',
  'digəri', 'üçüncüsü', 'hər', 'bu', 'bir', 'zəhmət', 'yenilənmiş', 'əsl', 'təkrar', 'şəxsi',
  'indeksin', 'cari', 'son', 'icraya', 'production', 'cdn', 'qeyddə', 'baxışa', 'yoxlamadan',
  'təhlil', 'əlaqə', 'health', 'idempotency', 'ehtiyat', 'əsas', 'açıqlamanızı', 'buraxılış',
  'alternativ', 'alternativi', 'texniki', 'qrafiki', 'tamamlayıb', 'ölçmələri',
]);
const requests = /(?:baxın|edin|etməyin|yazın|göndərin|bildirin|yoxlayın|ölçün|qaytarın|yönləndirin|dəqiqləşdirin|sınayın|seçin|unutmayın|yollayın|təsdiqləyin|baxaq|yoxlayaq|planlaşdıraq|dəqiqləşdirək|paylaşacağıq|təqdim edirik|keçirin|saxlamayın|dəyişək|rica edirik|müzakirə edək|qeyd edək)$/iu;
function request(words: readonly string[]): boolean { return requests.test(words.join(' ')); }
function predicate(word: string): boolean {
  if (names.has(word.toLocaleLowerCase('az-AZ')) || /^(?:bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on|hazır|keçmiş|bir-bir|illərdir|məcburi|karta|müdir|güclü|uğur)$/iu.test(word)) return false;
  const analyses = productiveMorphology.analyzeWord(word);
  if ((analyses.some(row => row.pos === 'noun') && !analyses.some(row => row.pos === 'verb')) || /^(?:dair|əsasən|olaraq|rica|təşəkkür)$/iu.test(word)) return false;
  return isFinitePredicate(word) || /(?:malıdır|məlidir|mayıb|məyib|mışıq|mişik|siniz|sınız|sınızmı|sinizmi|yoxdur|deyil|var|olmaz|bilirik|bilmirik|edirlər|etməyin|saxlamayın|silməyin|olunur)$/iu.test(word)
    || /(?:ilib|ılıb|ulub|ülüb)$/iu.test(word) || /(?:ır|ir|ur|ür|dır|dir|dur|dür|siniz|sınız|ıb|ib|ub|üb)(?:mı|mi|mu|mü)$/iu.test(word)
    || /(?:bilərik|bilərsiniz|axtarırıq|etdirək|hazırlayaq|başlamayaq|çəkməyin|göndərdik|saxlayaq|silməyin|gözləyək|normaldır|paylaşdıq|etdim|ötürürük)$/iu.test(word);
}
function converb(word: string): boolean { return /(?:ıb|ib|ub|üb)$/iu.test(word); }

export function segmentCorrespondence(text: string): string {
  const tokens = [...text.matchAll(/\p{L}+(?:-\p{L}+)*|[^\p{L}]+/gu)];
  let result = '', clauseStart = 0;
  for (let at = 0; at < tokens.length; at++) {
    const left = tokens[at][0], gap = tokens[at + 1]?.[0] ?? '', right = tokens[at + 2]?.[0] ?? '';
    result += left;
    if (/[.!?\n]/u.test(left)) clauseStart = result.length;
    if (!/^ +$/u.test(gap) || !predicate(left)) continue;
    const next = right.toLocaleLowerCase('az-AZ');
    if (continuesConverb(left, next, tokens[at + 4]?.[0] ?? '')) continue;
    if (/^(?:et|edin|edirik|edirəm|olacaq|deyil|olanda)$/iu.test(next)) continue;
    if (connectors.has(next) || /^(?:olanda|olarkən)$/iu.test(next)) continue;
    if (/(?:mış|miş|muş|müş)$/iu.test(left) && !openers.has(next)) continue;
    const before = result.slice(clauseStart);
    if (/(?:^|\s)(?:ki|əgər)(?:[\s,]|$)/iu.test(before)) continue;
    if ((before.match(/\p{L}+/gu)?.length ?? 0) < 2) continue;
    const remaining: string[] = [];
    for (let after = at + 2; after < Math.min(tokens.length, at + 46); after++) {
      if (/[.!?\n]/u.test(tokens[after][0])) break;
      if (/^\p{L}/u.test(tokens[after][0])) remaining.push(tokens[after][0].toLocaleLowerCase('az-AZ'));
    }
    if (!remaining.some(predicate) && !request(remaining)) continue;
    const analysis = productiveMorphology.analyzeWord(next);

    const nounObject = analysis.some(row => row.pos === 'noun' && ['accusative', 'dative'].includes(row.features.case ?? ''));
    const nounSubject = analysis.some(row => row.pos === 'noun' && row.features.case === 'nominative');
    const adjectival = analysis.some(row => row.pos === 'adjective');
    // Completed report followed by a separate request, subject or referential opener.
    // A converb followed by a bare verb/temporal adverb keeps the same subject.
    const passiveReport = productiveMorphology.analyzeWord(left).some(row => row.features.derivation?.includes('passive'));
    const contrastingPerson = (passiveReport || remaining.some(word => /bilərsiniz$/iu.test(word))) && remaining.some(word => /(?:dım|dim|dum|düm|dıq|dik|ıq|ik|acağıq|əcəyik|bilərsiniz)$/iu.test(word));
    const separate = (nounObject && contrastingPerson) || openers.has(next) || nounSubject || adjectival
      || ((nounObject || /(?:ını|ini|unu|ünü|ları|ləri|ləri|ni|nı|nu|nü|ləri|ə|a)$/iu.test(next)) && request(remaining))
      || (request(remaining) && remaining.length >= 1 && !/^(?:yenidən|sonra|indi)$/iu.test(next));
    if (converb(left) && !openers.has(next) && (predicate(next) || /^(?:tamamlayıb|hazırlayıb)$/iu.test(left))) continue;
    if (converb(left) && nounObject && !request(remaining) && !openers.has(next)
      && !contrastingPerson) continue;

    if (/^kim\s+[^.!?]+silib$/iu.test(before.trim()) && next === 'onu') continue;
    if (!separate || (converb(left) && /^(?:yenidən|sonra|indi)$/iu.test(next))) continue;
    if (/(?:bilirik|bilirəm|bilmirəm|soruşdum)$/iu.test(left)
      && /^(?:hansı|kim|niyə|necə)$/iu.test(next)) continue;
    result += detectQuestion(before) ? '?' : '.';
    clauseStart = result.length;
  }
  return result;
}
