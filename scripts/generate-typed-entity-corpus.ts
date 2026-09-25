/** Materialize morphology and context cases from a frozen reviewed name inventory.
 * Expected strings are built without invoking the production correction pipeline. */
import { writeFileSync } from 'node:fs';
import { places, multiwordPlaces } from '../lib/editor/entities/geo';
import { givenNames } from '../lib/editor/entities/person-names';
import { organizations } from '../lib/editor/entities/organizations';
import { culturalEntities } from '../lib/editor/entities/cultural';

type Entry = { id: string; category: string; input: string; expected: string };
const cases: Entry[] = [];
const ascii = (value: string) => value.toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu,
  letter => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[letter] ?? letter);
const add = (category: string, input: string, expected: string) => {
  cases.push({ id: `${category}-${String(cases.length + 1).padStart(4, '0')}`, category, input, expected });
};
const vowel = (name: string) => [...name.toLocaleLowerCase('az-AZ')].reverse().find(c => 'aəıioöuü'.includes(c)) ?? 'a';
const endings = (name: string) => {
  const v = vowel(name);
  const low = 'aıou'.includes(v) ? 'a' : 'ə';
  const high = 'oöuü'.includes(v) ? 'ou'.includes(v) ? 'u' : 'ü' : 'aı'.includes(v) ? 'ı' : 'i';
  const final = name.toLocaleLowerCase('az-AZ').at(-1) ?? '';
  const endsVowel = 'aəıioöuü'.includes(final);
  return [endsVowel ? `y${low}` : low, endsVowel ? `n${high}` : high,
    endsVowel ? `n${high}n` : `${high}n`, `d${low}`, `d${low}n`];
};
const geo = [...new Set(places)].filter(name => !name.includes(' '));
const frames: readonly (readonly string[])[] = [
  [' istiqamətində hərəkət etdik', ' doğru yola düşdük', ' səfər planlaşdırdıq',
    ' gedən avtobusu gözlədik'],
  [' ziyarət etdim', ' xəritədə axtardıq', ' bir daha görmək istərdim',
    ' yayda yenidən gördük'],
  [' tarixi barədə oxudum', ' sakinləri ilə görüşdük', ' mənzərəsini təsvir etdilər',
    ' coğrafiyasını araşdırdıq'],
  [' dostlarla görüşdüm', ' bir həftə qaldıq', ' yeni muzey açıldı',
    ' məqalə yazdıq'],
  [' qayıdan qonağı qarşıladıq', ' məktub aldıq', ' yeni xəbər gəldi',
    ' yola çıxan dostum zəng etdi'],
];
for (const [index, name] of geo.entries()) {
  const plain = ascii(name);
  add('place-in-prose', `${plain} haqqında danışdıq`, `${name} haqqında danışdıq.`);
  const forms = endings(name);
  for (let kind = 0; kind < 5; kind++) {
    // Inflection is exercised with five distinct grammatical roles.
    const tailIn = frames[kind][index % frames[kind].length];
    const tailOut = tailIn + '.';
    add(['dative', 'accusative', 'genitive', 'locative', 'ablative'][kind],
      `${plain}${ascii(forms[kind])}${tailIn}`, `${name}${forms[kind]}${tailOut}`);
  }
  if (plain.length >= 7) {
    const middle = Math.max(2, Math.floor(plain.length / 2));
    const lost = plain.slice(0, middle) + plain.slice(middle + 1);
    const doubled = plain.slice(0, middle) + plain[middle] + plain.slice(middle);
    const swapped = plain.slice(0, middle) + plain[middle + 1] + plain[middle] + plain.slice(middle + 2);
    const substituted = plain.slice(0, middle) + (plain[middle] === 'a' ? 'e' : 'a') + plain.slice(middle + 1);
    const typoFrames = [' barədə söhbət etdik', ' şəhəri barədə oxuduq',
      ' səfərini planlaşdırdıq', ' rayonu barədə danışdıq'];
    for (const [j, typo] of [lost, doubled, swapped, substituted].entries())
      add(['deleted-letter', 'duplicated-letter', 'transposed-letter', 'substituted-letter'][j],
        `${typo}${typoFrames[j]}`, `${name}${typoFrames[j]}.`);
  }
}
for (const name of [...new Set(givenNames)]) {
  const plain = ascii(name);
  add('person-with-title', `${plain} müəllim məktub yazdı`, `${name} müəllim məktub yazdı.`);
  add('person-with-honorific', `hörmətli ${plain}`, `Hörmətli ${name},`);
  add('person-with-surname', `${plain} əliyev gəldi`, `${name} Əliyev gəldi.`);
}
for (const name of [...multiwordPlaces, ...organizations, ...culturalEntities.filter(entity => entity.type !== 'celestial_body').map(entity => entity.canonical)]) {
  add('official-multiword', `mən ${ascii(name)} haqqında oxudum`, `Mən ${name} haqqında oxudum.`);
}
writeFileSync(new URL('../tests/fixtures/typed-entity-holdout.json', import.meta.url),
  JSON.stringify({ cases }, null, 2) + '\n');
console.log(`Frozen ${cases.length} generated cases (plus existing curated holdout).`);
