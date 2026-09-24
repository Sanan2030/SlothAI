// Explicit, auditable language rules. Ambiguous phrases remain unchanged.
export function repairPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])bugün(?=$|[^\p{L}])/giu, '$1bu gün')
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz) +de +(?=(?:gəl|ged|ed|düşün|işlə|bil|istə|keç)[\p{L}]+)/giu, '$1$2 də ')
    .replace(/(^|[^\p{L}])bir de (?=gecikmə(?:\s|$))/giu, '$1bir də ')
    .replace(/(^|[^\p{L}])bir birini(?=$|[^\p{L}])/giu, '$1bir-birini')
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
  const independentPredicate = '(?:çıxıram|çatmışam|yorulmuşam|məşğulam|görüşmürük|hazırdır|bitdi|tamamlanıb|yeniləndi|alındı|edilib|yönləndirildi|bağlanıb|araşdırılır|açılmır|soyuyub|gördüm|eşitdim|başladı|hazırladım|oyandım|açdım|gəldim|işlədim|qaldırılıb|baxıldı)';
  const independentStarter = '(?:mən|sən|biz|siz|o|birazdan|bir az|vaxtın|axşam|sabah|sonra|illərdir|nəticə|problem|müraciətiniz|təşəkkürlər|təşəkkür edirik|zəhmət olmasa|yenidən|baxa|əlavə|küçələr|saat|hava|pəncərəni)';
  result = result.replace(new RegExp(`(${independentPredicate}) +(?=${independentStarter}(?:\\s|$))`, 'giu'), '$1. ');

  // A question clause followed by a new subject gets a question boundary.
  result = result.replace(/(^|[.!?]\s+)((?:niyə|necə|harada|hara|kim|nə)\b[^.!?]{0,100}?\b(?:gəlmədin|etmədin|olmadı|açılmır|işləmir)) +(?=(?:mən|sən|biz|siz|o)\s)/giu, '$1$2? ');
  result = result.replace(/\b(haradasan|hardasan) +(?=(?:mən|sən|biz|siz|o)\s)/giu, '$1? ');

  // Common conditional/request punctuation.
  result = result
    .replace(/\b(vaxtın olsa|sualınız olarsa|sualin(?:iz)? olarsa) +/giu, '$1, ')
    .replace(/(^|[.!?]\s+|salam,\s+)(zəhmət olmasa|xahiş edirəm|xahiş edirik) +/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(səncə) +/giu, '$1$2, ')
    .replace(/ +(?=yoxsa\s)/giu, ', ')
    .replace(/\b(narahat olma) +(?=hər\s)/giu, '$1. ')
    .replace(/\b(görüşək) +(?=vaxtın\s)/giu, '$1. ');
  result = result.replace(/(hər vaxtınız xeyir|sabahınız xeyir|axşamınız xeyir) +(?=(?:zəhmət olmasa|xahiş edirəm|sabah|mən|biz|sorğu|sorğunuza|məlumat|problem|müraciət|qeyd|sizin|fayl|məsələ|nəticə)\s)/giu, '$1. ');
  result = result.replace(/(düşünürəm|bilirəm|bildirirəm|görürəm|qeyd edim) +ki +/giu, '$1 ki, ');
  result = result.replace(/(^|[.!?]\s+)(bəli|xeyr|əlbəttə|məsələn|digər tərəfdən)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(zəhmət olmasa|xahiş edirəm)\s+/giu, '$1$2, ');
  return result;
}
