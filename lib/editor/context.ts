// Explicit, auditable language rules. Ambiguous phrases remain unchanged.
export function repairPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])bugün(?=$|[^\p{L}])/giu, '$1bu gün')
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz) +de +(?=(?:gəl|ged|ed|düşün|işlə|bil|istə|keç)[\p{L}]+)/giu, '$1$2 də ')
    .replace(/(^|[^\p{L}])bir de (?=gecikmə(?:\s|$))/giu, '$1bir də ')
    .replace(/(^|[^\p{L}])bir birini(?=$|[^\p{L}])/giu, '$1bir-birini')
    .replace(/(^|[^\p{L}])bir bir(?=$|[^\p{L}])/giu, '$1bir-bir')
    .replace(/(^|[^\p{L}])hər seyden(?=$|[^\p{L}])/giu, '$1hər şeydən')
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz|o) +ise(?=$|[^\p{L}])/giu, '$1$2 isə')
    .replace(/(^|[^\p{L}])(səhifəni|səhifəsini|faylı|terminalı|pəncərəni|linki|sənədi|müraciəti)(\s+yenidən)? +ac(?=$|[^\p{L}])/giu, '$1$2$3 aç')
    .replace(/(^|[^\p{L}])basa +(?=düş[\p{L}]*)/giu, '$1başa ')
    .replace(/(^|[^\p{L}])əvvəl de +(?=demiş[\p{L}]*)/giu, '$1əvvəl də ')
    .replace(/(^|[^\p{L}])çoxdan +(?=görüşmür[\p{L}]*)/giu, '$1çoxdandır ')
    .replace(/(^|[^\p{L}])mən de +(?=sənə\b)/giu, '$1mən də ')
    .replace(/\b(test) qalib\b/giu, '$1 qalıb')
    .replace(/(^|[^\p{L}])seher(?= saat| tezdən| tezədən)/giu, '$1səhər')
    .replace(/(sabah|bu gün) seher(?=$|[^\p{L}])/giu, '$1 səhər')
    .replace(/(^|[^\p{L}])sistem analitik kimi(?=$|[^\p{L}])/giu, '$1sistem analitiki kimi')
    .replace(/(^|[^\p{L}])Nike air max(?=$|[^\p{L}])/giu, '$1Nike Air Max')
    .replace(/(^|[^\p{L}])Jordan stadium(?=$|[^\p{L}])/giu, '$1Jordan Stadium')
    .replace(/(^|[^\p{L}])hərşey(?=$|[^\p{L}])/giu, '$1hər şey')
    .replace(/(^|[^\p{L}])heçnə(?=$|[^\p{L}])/giu, '$1heç nə')
    .replace(/(^|[^\p{L}])birşey(?=$|[^\p{L}])/giu, '$1bir şey')
    .replace(/(^|[^\p{L}])get-gədə(?=$|[^\p{L}])/giu, '$1get-gedə')
    // "Səhərin ilk işığı" is a fixed literary construction. The bare form
    // "səhərin" is ambiguous with "şəhərin", so only repair this context.
    .replace(/(^|[^\p{L}])şəhərin ilk işığı(?=$|[^\p{L}])/giu, '$1səhərin ilk işığı')
    // These are predicate contexts for "qurmaq", not the noun "qürur".
    .replace(/(körpü|gələcəyini bu gün|özü|onu) qürur(?=[,.!?]|$)/giu, '$1 qurur')
    // "Pes etmək" is an established borrowed verb and must not become "pəs".
    .replace(/(^|[^\p{L}])pəs (?=etm[\p{L}]*)/giu, '$1pes ')
    .replace(/(^|[^\p{L}])sağolun(?=$|[^\p{L}])/giu, '$1sağ olun')
    .replace(/(^|[^\p{L}])sağol(?=$|[^\p{L}])/giu, '$1sağ ol')
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz)\s+(gəlirəm|gedirəm|edirəm|gəlirsən|gedirsən|edirsən)(?=$|[^\p{L}])/giu,
      (_, prefix: string, subject: string, verb: string) => {
        const root = verb.replace(/(?:əm|sən)$/, '');
        const ending: Record<string, string> = { mən: 'əm', sən: 'sən', biz: 'ik', siz: 'siniz' };
        return prefix + subject + ' ' + root + ending[subject.toLocaleLowerCase('az-AZ')];
      });
}

export function sentenceBoundaries(text: string): string {
  // Split only a reviewed finite predicate followed by a likely independent
  // clause. Do not split noun phrases such as "mən gələndə sən ...".
  const finite = '(?:gəlirəm|gedirəm|edirəm|gəlirik|gedirik|edirik|gəldim|getdim|getdin|etdim|gələcəyəm|gedəcəyəm|gözləyirəm|yaxşıyam|yaxşıdır|pisəm|işləyir|işləmir|hazırdır|bitdi)';
  let result = text.replace(new RegExp(`(${finite}) +(?=(?:mən|sən|biz|siz|sabah|dünən|xahiş) +)`, 'giu'), '$1. ');
  result = result.replace(/([^,.!?:;\s]) +(?=(?:bundan əlavə|digər tərəfdən|nəticə olaraq)\s)/giu,
    (match: string, last: string, offset: number, whole: string) => {
      const next = whole.slice(offset + match.length);
      const clause = whole.slice(0, offset).split(/[.!?\n]/).at(-1) ?? '';
      // Paired contrast belongs to one sentence, not two unrelated paragraphs.
      if (/^digər tərəfdən\s/iu.test(next) && /bir tərəfdən\s/iu.test(clause)) return last + ', ';
      return last + '. ';
    });
  result = result.replace(/(göndərin|yoxlayın|baxın|edin|gəlin) +(?=təşəkkür edirəm(?:\s|$))/giu, '$1. ');

  // Reviewed finite predicates followed by a clearly independent clause.
  // This is deliberately bounded to common predicates/starters instead of
  // guessing a boundary after every verb.
  const independentPredicate = '(?:çıxıram|çatmışam|yorulmuşam|məşğulam|görüşmürük|hazırdır|bitdi|tamamlanıb|yeniləndi|dəyərləndirildi|alındı|edilib|yönləndirildi|bağlanıb|araşdırılır|açılmır|soyuyub|gördüm|eşitdim|başladı|hazırladım|oyandım|açdım|gəldim|işlədim|qaldırılıb|baxıldı|qalxırdı|qaralırdı|bilərəm|düşmədim)';
  const independentStarter = '(?:mən|sən|biz|siz|o|birazdan|bir az|vaxtın|axşam|sabah|sonra|indi|illərdir|nəticə|problem|müraciətiniz|təşəkkürlər|təşəkkür edirik|zəhmət olmasa|yenidən|baxa|əlavə|küçələr|saat|hava|pəncərəni|başlaya|göndərə|dönüb|bir gün|məni)';
  result = result.replace(new RegExp(`(${independentPredicate}) +(?=${independentStarter}(?:\\s|$))`, 'giu'), '$1. ');

  // A question clause followed by a new subject gets a question boundary.
  result = result.replace(/((?:niyə|necə|harada|hara|kim|nə)\s+[^.!?]{0,100}?(?:gəlmədin|etmədin|olmadı|açılmır|işləmir)) +(?=(?:mən|sən|biz|siz|o)\s)/giu, '$1? ');
  result = result.replace(/\b(haradasan|hardasan) +(?=(?:mən|sən|biz|siz|o)\s)/giu, '$1? ');

  // Common conditional/request punctuation.
  result = result
    .replace(/\b(vaxtın olsa|sualınız olarsa|sualin(?:iz)? olarsa) +/giu, '$1, ')
    .replace(/\b(zəhmət olmasa|xahiş edirəm|xahiş edirik)(?!,) +/giu, '$1, ')
    .replace(/(^|[.!?]\s+)(səncə) +/giu, '$1$2, ')
    .replace(/([^,;.!?:\s]) +(?=yoxsa\s)/giu, '$1, ')
    .replace(/\b(narahat olma) +(?=hər\s)/giu, '$1. ')
    .replace(/\b(görüşək) +(?=vaxtın\s)/giu, '$1. ')
    .replace(/\b(sağ ol) +(?=köməyin\s+üçün\b)/giu, '$1, ')
    .replace(/\b(razıyam) +(bəs|beş) +(sən|siz)\b/giu, '$1. bəs $3?')
    .replace(/\b(təşəkkür edirik) +(?=(?:müraciətiniz|təklifinizi)\b)/giu, '$1. ')
    .replace(/\b(yaxşı) +(?=onda\b)/giu, '$1, ')
    .replace(/\b(çalışdıq) +(?=cavab ala bilmədik\b)/giu, '$1, ')
    .replace(/\b(olmamışam|gecikirdim) +(ona görə)\b/giu, '$1, $2')
    .replace(/(^|[.!?]\s+)(xeyir) +(?=necəsən\b)/giu, '$1$2, ')
    .replace(/\b(olacaq) +(düzdür)(?=$|[.!?\s])/giu, '$1, $2?');
  result = result.replace(/(hər vaxtınız xeyir|sabahınız xeyir|axşamınız xeyir) +(?=(?:zəhmət olmasa|xahiş edirəm|sabah|mən|biz|sorğu|sorğunuza|məlumat|problem|müraciət|qeyd|sizin|fayl|məsələ|nəticə)\s)/giu, '$1. ');
  result = result.replace(/(düşünürəm|bilirəm|bildirirəm|görürəm|qeyd edim) +ki +/giu, '$1 ki, ');
  result = result.replace(/(^|[.!?]\s+)(bəli|xeyr|əlbəttə|məsələn|digər tərəfdən)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(zəhmət olmasa|xahiş edirəm)\s+/giu, '$1$2, ');
  return result;
}
