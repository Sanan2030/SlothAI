import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEmail } from '../lib/editor/correct';

// Independently written correspondence with different recipients, goals and closings.
const letters = [
  { recipient: 'komanda', keyword: 'workflow', input: `Mövzu: RSD icazələri
Hörmətli komanda,
RSD-də sənəd növü seçildikdən sonra müraciət göndərilə bilər. Workflow mərhələlərində yeni qayda qüvvəyə minib.

Əgər icazəniz görünmürsə, xidmət masasına müraciət edin. Texniki qrup müraciətinizi araşdıracaq.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'Elvin bəy', keyword: 'API', input: `Mövzu: API xətası
Hörmətli Elvin bəy,
Production mühitində API sorğularının bir hissəsi uğursuz oldu. Monitorinq jurnallarını yoxladıq.

Backend komandasına hadisənin vaxtını və request nümunəsini göndərmişik. Problemin kökü müəyyən ediləndə məlumat verəcəyik.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'Aysel xanım', keyword: 'SRS', input: `Mövzu: SRS sənədi
Hörmətli Aysel xanım,
SRS sənədində BPMN diaqramı yeniləndi. UAT meyarları ayrıca bölmədə yerləşdirildi.

Sizdən xahiş edirik ki, son versiyanı nəzərdən keçirəsiniz. Şərhiniz olarsa, sənədə qeyd əlavə edin.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'texniki komanda', keyword: 'server', input: `Mövzu: Server monitorinqi
Hörmətli texniki komanda,
Gecə ərzində serverin yaddaş istifadəsi artdı. Növbətçi mühəndis hadisəni qeydiyyata aldı.

İstifadəçilərin işində dayanma müşahidə edilməyib. Təhlilin nəticəsini sabahkı iclasda paylaşacağıq.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'biznes analitiklər', keyword: 'tələblər', input: `Mövzu: Görüş nəticəsi
Hörmətli biznes analitiklər,
Müştərinin tələbləri ilkin mərhələdə sənədləşdirildi. Mövcud proses ayrıca diaqramda göstərildi.

Yeni funksional sualların siyahısı əlavə olunub. Cavabları aldıqdan sonra yekun sənədi hazırlayacağıq.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'tərəfdaşlar', keyword: 'müqavilə', input: `Mövzu: Müqavilə layihəsi
Hörmətli tərəfdaşlar,
Müqavilənin yenilənmiş versiyasını nəzərdən keçirdik. Ödəniş cədvəli razılaşdırılmış şərtlərə uyğundur.

İki maddə ilə bağlı izahınıza ehtiyacımız var. Rəyinizi göndərdikdən sonra imzalanma tarixini dəqiqləşdirə bilərik.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'istifadəçilər', keyword: 'hesab', input: `Mövzu: Hesab təhlükəsizliyi
Hörmətli istifadəçilər,
Hesabınıza giriş üçün iki faktorlu doğrulama aktivləşdirilir. Bu dəyişiklik şəxsi məlumatların qorunmasına xidmət edir.

İlk giriş zamanı ekrandakı təlimata əməl edin. Çətinlik yaransa, dəstək qrupuna yazın.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'məsul şəxslər', keyword: 'arxiv', input: `Mövzu: Elektron arxiv
Hörmətli məsul şəxslər,
Sənədlərin surəti elektron arxivdə saxlanılır. Köhnə sistemdəki faylların köçürülməsi mərhələli aparılır.

Hər mərhələnin sonunda sənəd sayı yoxlanılacaq. Uyğunsuzluq görsəniz, qeydiyyat nömrəsini göndərin.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'layihə komandası', keyword: 'test', input: `Mövzu: Sınaq mühiti
Hörmətli layihə komandası,
Yeni build test mühitinə yerləşdirildi. Əvvəlki versiyadakı iki xəta düzəldilib.

Xahiş edirik, qəbul meyarlarını yenidən yoxlayın. Nəticəni iclasdan əvvəl paylaşmağınız planlaşdırmanı asanlaşdıracaq.
Hörmətlə,
Sənan Nabizadə` },
  { recipient: 'müştəri', keyword: 'müraciət', input: `Mövzu: Müraciətiniz
Hörmətli müştəri,
Müraciətiniz qeydiyyata alınıb. Mütəxəssisimiz təqdim etdiyiniz məlumatları yoxlayır.

Əlavə sənəd tələb olunarsa, sizinlə əlaqə saxlayacağıq. Nəticə hazır olan kimi bildiriş göndəriləcək.
Təşəkkürlə,
Sənan Nabizadə` },
] as const;

for (const { recipient, keyword, input } of letters) {
  test(`independent email structure: ${recipient}`, () => {
    const output = formatEmail(input).text;
    assert.match(output, /^Mövzu: [^\n]+\n\nHörmətli [^\n]+,\n\n/u);
    assert.ok(output.toLocaleLowerCase('az-AZ').includes(keyword.toLocaleLowerCase('az-AZ')));
    assert.equal(output.split(/\n\n/u).length >= 4, true);
    assert.equal((output.match(/^Mövzu:/gmu) ?? []).length, 1);
    assert.equal((output.match(/^(?:Hörmətlə|Təşəkkürlə),/gmu) ?? []).length, 1);
    assert.equal(formatEmail(output).text, output);
  });
}

const compactCases = [
  {
    input: 'hormetli komanda rsd de sened novu secilenden sonra muraciet gonderilecek amma workflow icraciya teyin edilmir zehmet olmasa baxin hormetle senan',
    greeting: 'Hörmətli komanda,',
    clauses: ['RSD-də sənəd növü', 'workflow icraçıya təyin edilmir.', 'Zəhmət olmasa, baxın.'],
  },
  {
    input: 'movzu production xetasi salam elvin bey api endpointi productionda 500 qaytarir stagingde isleyir bugun loglari yoxladiq sebebi hele belli deyil xahis edirik analiz edin hormetle server komandasi',
    greeting: 'Hörmətli Elvin bəy,',
    clauses: ['Mövzu: Production xətası', 'API endpoint-i', 'Bu gün logları yoxladıq.', 'Səbəbi hələ bəlli deyil.', 'Xahiş edirik, analiz edin.'],
  },
  {
    input: 'hormetli aysel xanim srs senedinde bpmn diaqrami ve uat meyarlari yeniden baxilmalidir birinci meseleni analiz etdik ikinci meselede test ssenarileri catismir uat ucun cavab gozleyirik tesekkurle komanda',
    greeting: 'Hörmətli Aysel xanım,',
    clauses: ['SRS sənədində BPMN diaqramı', 'Birinci məsələni analiz etdik.', 'İkinci məsələdə test ssenariləri çatışmır.', 'UAT üçün cavab gözləyirik.'],
  },
] as const;

for (const [index, example] of compactCases.entries()) {
  test(`distinct one-line business email ${index + 1}`, () => {
    const output = formatEmail(example.input).text;
    assert.ok(output.includes(example.greeting));
    for (const clause of example.clauses) assert.ok(output.includes(clause), clause);
    assert.equal(formatEmail(output).text, output);
  });
}
