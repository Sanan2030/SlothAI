import { namedEntity, type NamedEntity } from './types';

export const organizations = [
  'Azərbaycan Dəmir Yolları', 'Azərbaycan Respublikasının Mərkəzi Bankı',
  'Bakı Dövlət Universiteti', 'Azərbaycan Milli Elmlər Akademiyası', 'Dövlət İmtahan Mərkəzi',
  'Azərbaycan Respublikasının Nazirlər Kabineti', 'Azərbaycan Respublikasının Milli Məclisi',
  'Azərbaycan Respublikasının Xarici İşlər Nazirliyi', 'Bakı Şəhər İcra Hakimiyyəti',
  'Ağstafa Rayon Təhsil Şöbəsi', 'Bakı Beynəlxalq Multikulturalizm Mərkəzi',
  'Yeni Azərbaycan Partiyası', 'Azərbaycan Respublikasının Elm və Təhsil Nazirliyi',
  'Azərbaycan Respublikasının Səhiyyə Nazirliyi',
  'Azərbaycan Respublikasının Dövlət Gömrük Komitəsi',
];
export const organizationEntities: readonly NamedEntity[] = organizations.map(name => namedEntity(name,
  name.endsWith('Partiyası') ? 'political_party' : /(?:Nazirliyi|Kabineti|Məclisi|Hakimiyyəti|Komitəsi|Mərkəzi)$/u.test(name)
    ? 'state_body' : 'organization', 'all_lexical_words', 'last_word', 'reviewed-local'));
