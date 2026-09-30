/** Reviewed contextual repairs. No full-sentence lookup or evaluation fixture imports. */
export function prepareReviewedContext(text: string): string {
  return text
    .replace(/(?<!\p{L})el(?=\s+(?:ile|ilə)\b)/giu, 'əl')
    .replace(/(?<!\p{L})post(?=\s+g[oö]nd[eə]ri[sş])/giu, 'poçt')
    .replace(/(?<!\p{L})icin(?!\p{L})/giu, 'üçün')
    .replace(/(?<!\p{L})(?:aynı|ayni)(?!\p{L})/giu, 'eyni')
    .replace(/(?<!\p{L})(m[eə]tn|fayl[iı]|[sş]ifr[eə]|qeyd) +qalib(?=\s*(?:[.!?]|$))/giu, '$1 qalıb')
    .replace(/(?<!\p{L})adi(?=\s+(?:sertifikatla|sad[eə]c[eə]))/giu, 'adı')
    .replace(/(?<!\p{L})uc(?=\s+(?:g[oö]st[eə]rilir|add[iı]m))/giu, 'üç')
    .replace(/(?<!\p{L})de(?=\s+(?:redakt[eə]|qorunur|korunur|g[oö]nd[eə]ril|g[oö]st[eə]ril|bildiri[sş]))/giu, 'də')
    .replace(/(?<!\p{L})yarisinda(?!\p{L})/giu, 'yarısında')
    .replace(/(?<!\p{L})ac[iı]qdir(?!\p{L})/giu, 'açıqdır')
    
    .replace(/(?<!\p{L})məcburi(?!\p{L})/giu, 'məcburi')
    .replace(/(?<!\p{L})artsa(?!\p{L})/giu, 'artsa')
    .replace(/(?<!\p{L})sira(?=\s+d[eə]yi[sş])/giu, 'sıra')
    .replace(/(?<!\p{L})moda(?=\s+ad[iı]n[iı])/giu, 'modun')
    .replace(/(?<!\p{L})cevirme\s+kuru(?!\p{L})/giu, 'çevirmə kursu')
    .replace(/(?<!\p{L})e\s+imza(?!\p{L})/giu, 'e-imza')
    .replace(/(?<!\p{L})hesab\s+faktura(?!\p{L})/giu, 'hesab-faktura')
    .replace(/(?<!\p{L})ad\s+soyad(?!\p{L})/giu, 'ad-soyad')
    .replace(/(?<!\p{L})qeyri\s+adi(?!\p{L})/giu, 'qeyri-adi')
    .replace(/(?<!\p{L})roll\s+back(?!\p{L})/giu, 'rollback')
    // Foreign identifiers use a hyphen before an Azerbaijani case suffix.
    .replace(/(?<!\p{L})(ID|SHA|API|PDF|cookie|schema|body|template|local storage)\s+(sına|sinin|sini|si|ni|ində|inde|də|de|a)(?!\p{L})/giu,
      (_all, raw: string, suffix: string) => {
        const term = /^(?:id|sha|api|pdf)$/iu.test(raw) ? raw.toUpperCase() : raw;
        const endings: Record<string, string> = { inde: 'ində', de: 'də', a: term === 'PDF' ? 'ə' : 'a',
          sini: term === 'schema' ? 'sını' : 'sini' };
        return term + '-' + (endings[suffix] ?? suffix);
      })
         .replace(/(?<!\p{L})statusu\s+h[eə]ll\s+olundu(?=\s+olaraq)/giu, 'statusu “həll olundu”')
    .replace(/(?<!\p{L})lucidchartda(?!\p{L})/giu, 'Lucidchart-da');
}
