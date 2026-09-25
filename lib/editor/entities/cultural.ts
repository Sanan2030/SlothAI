import { namedEntity, type NamedEntity } from './types';
const events = ['Vətən müharibəsi', 'Çaldıran döyüşü', 'Dəmir dövrü', 'Səfəvilər sülaləsi', 'Versal sülhü'];
const holidays = ['Novruz bayramı', 'Qurban bayramı'];
const calendar = ['20 Yanvar', '28 May', '8 Mart', 'Beynəlxalq Ana Dili Günü',
  'Beynəlxalq Qadınlar Günü', 'Dünya Azərbaycanlılarının Həmrəyliyi Günü'];
const titles = ['Əməkdar müəllim', 'Əməkdar incəsənət xadimi', 'Xalq şairi',
  'Azərbaycanın Milli Qəhrəmanı', 'Sovet İttifaqı Qəhrəmanı'];
const scriptures = ['Quran', 'Bibliya', 'İncil', 'Tövrat'];
const celestial = ['Günəş', 'Ay', 'Yupiter', 'Saturn', 'Venera'];
export const culturalEntities: readonly NamedEntity[] = [
  ...events.map(name => namedEntity(name, 'historical_event', 'first_lexical_word', 'none', 'orthography-2019-2020')),
  ...holidays.map(name => namedEntity(name, 'holiday', 'first_lexical_word', 'none', 'orthography-2019-2020')),
  ...calendar.map(name => namedEntity(name, 'calendar_event', name.includes('Günü') || /^\d/u.test(name)
    ? 'all_lexical_words' : 'first_lexical_word', 'none', 'orthography-2019-2020')),
  ...titles.map(name => namedEntity(name, 'honorary_title', name.includes('Qəhrəmanı')
    ? 'all_lexical_words' : 'first_lexical_word', 'none', 'orthography-2019-2020')),
  namedEntity('Azərbaycan Respublikasının Dövlət Himni', 'state_symbol', 'all_lexical_words', 'none', 'orthography-2019-2020'),
  ...scriptures.map(name => namedEntity(name, 'religious_text', 'official_name', 'none', 'orthography-2019-2020')),
  ...celestial.map(name => namedEntity(name, 'celestial_body', 'contextual', 'none', 'orthography-2019-2020')),
  namedEntity('Azərbaycan Respublikasının səhiyyə naziri', 'position_title', 'first_lexical_word', 'none', 'orthography-2019-2020'),
  namedEntity('Azərbaycan Respublikasının kənd təsərrüfatı naziri', 'position_title', 'first_lexical_word', 'none', 'orthography-2019-2020'),
];
