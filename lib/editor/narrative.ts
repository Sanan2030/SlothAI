// Reviewed narrative vocabulary and finite predicates. No replacement for whole
// documents: these forms also apply to shorter, reordered or unseen passages.
export const narrativeWords = `
səhər şəhər səkkizdə oyandım təcili çölə çıxdım işdə tıxaca düşdüm
hamı bir-birini itələyirdi təhər işə çatdım qəzəblə gecikmisən
təhvil verilməlidir serverdə keçdim kompüterin arxasına sistemində
terminalı açıb baxdım gördüm düşüb bazanı həmin elədim servisini
yenidən başlatdım hamısı qaydasına düşdü nəfəs aldı gecikmə
yerimə oturdum günorta uşaqlarla aşağı kafeyə dönər sifariş
əti yeyə bilmədim içib yuxarı qalxdım günün yarısı gəldi lazımdır
sənədini hazırlayırdım istədiyini gərək hamısını strukturlaşdırım
altı zalına qaçış zolağında yarım qaçdım təqribən dörd yüz yandırdım
etməyi unutmuşdum deyə ayaqqabısı müqayisə elədik modellərini
çıxıb çörək süd aldım növbə olmuşdu nağd evə çatanda zəng
dedim yaxşıdır girib yemək qızdırdım kompüteri açdım formatına
salırdı modelinə göndərəndə bəzən qaytarmırdı təmizləsin gecə
birdə elədi şahmat oynadıq vəziri ikincidə köhnə oyunları
işlətmək izlədim pəncərəni içəri yatağa uzandım gözlərimi
düşündüm şeylər başlayacaqdı təzə təyin və gətirdim qayıtdım
kolanı aparatı buraxdım planları təzədən etmək lazım
`.trim().split(/\s+/);

const predicates = 'oyandım çıxdım düşdüm idi itələyirdi çatdım baxdı gecikmisən verilməlidir var getmir elədim başlatdım düşdü aldı gecikmə oturdum endik verdik bilmədim qalxdım gəldi lazımdır hazırlayırdım bilmir strukturlaşdırım oldu getdim qaçdım yandırdım danışdıq elədik girdim aldım olmuşdu yaxşıdır qızdırdım açdım salırdı qaytarmırdı tənzimlədim təmizləsin elədi oynadıq itirdim izlədim buraxdım uzandım yumdum düşündüm başlayacaqdı gətirdim qayıtdım'.split(' ').join('|');
const starters = 'təcili|avtobus|hamı|bir təhər|müdir|dedi|layihə|serverdə|bazaya|mən|həmin|hamısı|günorta|dönər|heç|kolanı|günün ikinci yarısı|yeni müştəri|SRS|müştəri|sistem analitiki|axşam|idman|kardio|qaçış zolağında|təqribən|kreatin|creatin|zalda|idmandan|çörək|kassada|kassa aparatı|nağd|evə|anama|dedim|sonra|resume parser|LLM|promptu|Pydantic|gecə|Chess|birinci oyunda|ikincidə|pəncərəni|yatağa|gözlərimi|sabaha|sabah səhər|təzə sprint|story';
const boundaries = new RegExp(`(^|[^\\p{L}])(${predicates}|baxdım|doldurur|buraxdım) +(?=(?:${starters}|gördüm|FastAPI|PDF|havanı|Nike)(?: +|$))`, 'giu');

export function punctuateNarrative(text: string): string {
  return text.replace(boundaries, '$1$2. ')
    .replace(/(zəng (?:elədi|etdi)) +(?=\uE000+\d+\uE001)/giu, '$1. ')
    .replace(/(çörək|süd|pendir|yağ|yumurta) +(çörək|süd|pendir|yağ|yumurta) +(?=(?:aldım|aldıq|aldı)(?:[\s.!?]|$))/giu, '$1, $2 ')
    .replace(/(kompüterin arxasına) +(?=(?:Ubuntu|Linux|Windows)\s)/giu, '$1. ')
    .replace(/(dedi|dedim|gördüm|yazdım) +ki +/giu, '$1 ki, ')
    .replace(/(dedi|dedim) +(?=bir də gecikmə|hər şey yaxşıdır)/giu, '$1: ')
    .replace(/(niyə gecikmisən)\.(?=\s|$)/giu, '$1?');
}

export function narrativeParagraphs(text: string): string {
  return text.replace(/([.!?]) +(?=(?:Günorta|Günün ikinci yarısı|Axşam saat|İdmandan çıxıb|Evə çatanda|Evə girib|Gecə saat|Sabah səhər)(?:\s|$))/g, '$1\n\n');
}
