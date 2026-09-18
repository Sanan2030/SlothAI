// Generate only reviewed regular forms; this is not a general morphological parser.
export function regularForms(): string[] {
  const nouns = 'məktəb müəllim tələbə şəhər kənd küçə otaq sənəd mətn layihə məsələ şirkət müştəri əməkdaş rəhbər görüş sorğu sual cavab dəyişiklik məlumat proqram cümlə səhifə istifadəçi'.split(' ');
  const forms: string[] = [];
  for (const noun of nouns) {
    const last = noun.match(/[aıoueəiöü]/g)!.at(-1)!;
    const front = /[eəiöü]/.test(last);
    const a = front ? 'ə' : 'a';
    const i = /[aı]/.test(last) ? 'ı' : /[ou]/.test(last) ? 'u' : /[öü]/.test(last) ? 'ü' : 'i';
    const plural = noun + (front ? 'lər' : 'lar');
    for (const base of [noun, plural]) {
      const vowelEnd = /[aıoueəiöü]$/.test(base);
      const caseI = base === plural ? (front ? 'i' : 'ı') : i;
      // k -> y only for these reviewed stems before vowel-initial endings.
      const stem = base === 'dəyişiklik' ? 'dəyişikliy' : base === 'otaq' ? 'otağ' : base;
      forms.push(base, stem + (vowelEnd ? 'y' : '') + a,
        stem + (vowelEnd ? 'n' : '') + caseI, stem + (vowelEnd ? 'n' : '') + caseI + 'n',
        base + 'd' + a, base + 'd' + a + 'n',
        stem + (vowelEnd ? '' : caseI) + 'm', stem + (vowelEnd ? '' : caseI) + 'n',
        stem + (vowelEnd ? 's' : '') + caseI);
    }
  }
  for (const present of 'gəlir gedir düşünür görür eşidir danışır çalışır işləyir oxuyur yazır gözləyir başlayır istəyir bilir edir göndərir düzəldir'.split(' ')) {
    const last = present.match(/[aıoueəiöü]/g)!.at(-1)!;
    const front = /[eəiöü]/.test(last);
    const i = last === 'ı' ? 'ı' : last === 'u' ? 'u' : last === 'ü' ? 'ü' : 'i';
    forms.push(present, present + (front ? 'əm' : 'am'), present + 's' + (front ? 'ən' : 'an'),
      present + i + (front ? 'k' : 'q'), present + 's' + i + 'n' + i + 'z', present + (front ? 'lər' : 'lar'));
  }
  return forms;
}
