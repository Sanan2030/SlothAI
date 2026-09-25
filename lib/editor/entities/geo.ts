import { namedEntity, type NamedEntity } from './types';

const countries = `Azərbaycan|Türkiyə|Gürcüstan|Rusiya|İran|Almaniya|Fransa|İtaliya|İspaniya|ABŞ|Birləşmiş Ərəb Əmirlikləri`.split('|');
const cities = `Bakı|Gəncə|Sumqayıt|Naxçıvan|Şuşa|Xankəndi|Lənkəran|Şirvan|Mingəçevir|Naftalan|Şəki|Yevlax|Xocalı|Şamaxı`.split('|');
const districts = `Laçın|Kəlbəcər|Ağdam|Füzuli|Cəbrayıl|Zəngilan|Qubadlı|Xocavənd|Ağdərə|Qəbələ|Quba|Qusar|Xaçmaz|Astara|Masallı|Cəlilabad|Biləsuvar|Salyan|Neftçala|Hacıqabul|Saatlı|Sabirabad|İmişli|Beyləqan|Ağcabədi|Bərdə|Tərtər|Göyçay|Ucar|Kürdəmir|Ağsu|İsmayıllı|Oğuz|Qax|Zaqatala|Balakən|Qazax|Ağstafa|Tovuz|Şəmkir|Gədəbəy|Daşkəsən|Göygöl|Samux|Goranboy|Abşeron|Xızı|Siyəzən|Şabran|Qobustan|Ordubad|Culfa|Şərur|Babək|Sədərək|Kəngərli|Şahbuz`.split('|');
const regions = ['Qarabağ', 'Avropa', 'Asiya', 'Afrika'];
export const places = [...new Set([...countries, ...cities, ...districts, ...regions, 'Xəzər'])];
const singles: NamedEntity[] = [
  ...countries.filter(value => !value.includes(' ')).map(value => namedEntity(value, 'country', 'official_name', 'single_word', 'reviewed-local')),
  ...cities.map(value => namedEntity(value, 'city', 'official_name', 'single_word', 'statistics-2025')),
  ...districts.map(value => namedEntity(value, 'district', 'official_name', 'single_word', 'statistics-2025')),
  ...regions.map(value => namedEntity(value, 'region', 'official_name', 'single_word', 'reviewed-local')),
  namedEntity('Xəzər', 'sea', 'official_name', 'single_word', 'orthography-2019-2020'),
];
const officialCountries = ['Azərbaycan Respublikası', 'İran İslam Respublikası', 'Birləşmiş Ərəb Əmirlikləri'];
const geographicGenerics: [string, NamedEntity['type']][] = [
  ['Xəzər dənizi', 'sea'], ['Qara dəniz', 'sea'], ['Kür çayı', 'river'], ['Araz çayı', 'river'],
  ['Baykal gölü', 'lake'], ['Bakı şəhəri', 'city'], ['Salyan rayonu', 'district'],
  ['Azadlıq meydanı', 'square'], ['Şəhidlər xiyabanı', 'monument'],
  ['Neftçilər prospekti', 'street'], ['Əhməd Cavad küçəsi', 'street'],
  ['Kəpəz dağı', 'mountain'], ['Nargin adası', 'island'], ['Ramana qalası', 'monument'],
  ['Qarabağ bölgəsi', 'region'], ['Şüvəlan qəsəbəsi', 'district'],
  ['Hökməli kəndi', 'district'], ['Culfa düzənliyi', 'region'],
];
export const multiwordPlaces = ['Naxçıvan Muxtar Respublikası', ...geographicGenerics.map(([name]) => name)];
export const geographicEntities: readonly NamedEntity[] = [
  ...singles,
  ...officialCountries.map(name => namedEntity(name, 'country', 'all_lexical_words', 'last_word', 'orthography-2019-2020')),
  namedEntity('Naxçıvan Muxtar Respublikası', 'autonomous_republic', 'all_lexical_words', 'last_word', 'orthography-2019-2020'),
  ...geographicGenerics.map(([name, type]) => namedEntity(name, type, 'geographic_generic_lower', 'last_word', 'orthography-2019-2020')),
];
