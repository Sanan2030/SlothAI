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
  result = result.replace(/([^.!?:;\s]) +(?=(?:bundan əlavə|digər tərəfdən|nəticə olaraq)\s)/giu, '$1. ');
  result = result.replace(/(göndərin|yoxlayın|baxın|edin|gəlin) +(?=təşəkkür edirəm(?:\s|$))/giu, '$1. ');
  result = result.replace(/(hər vaxtınız xeyir|sabahınız xeyir|axşamınız xeyir) +(?=(?:zəhmət olmasa|xahiş edirəm|sabah|mən|biz)\s)/giu, '$1. ');
  result = result.replace(/(düşünürəm|bilirəm|bildirirəm|görürəm) +ki +/giu, '$1 ki, ');
  result = result.replace(/(^|[.!?]\s+)(bəli|xeyr|əlbəttə|məsələn)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(zəhmət olmasa|xahiş edirəm)\s+/giu, '$1$2, ');
  return result;
}
