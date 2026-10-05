/** Offline, assistant-authored compositional evaluation, never training data.
 * Run once before tuning. The checked-in SHA256 freezes both inputs and targets. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const groups: [string, string[], string[]][] = [
  ['education', ['Müəllim', 'Təlimçi', 'Məktəbin direktoru', 'Gənc tədqiqatçı', 'Kursun rəhbəri'], ['dərsin mövzusunu izah etdi.', 'tələbələrin suallarını cavablandırdı.', 'yeni təlim proqramını hazırladı.']],
  ['medicine', ['Həkim', 'Tibb bacısı', 'Klinikanın rəhbəri', 'Növbətçi mütəxəssis', 'Xəstəxananın əməkdaşı'], ['xəstənin vəziyyətini yoxladı.', 'müayinə nəticələrini qeyd etdi.', 'yeni müalicə planını nəzərdən keçirdi.']],
  ['documents', ['Qeydiyyat operatoru', 'Arxiv işçisi', 'Şöbənin rəhbəri', 'Sənədin müəllifi', 'Məsul icraçı'], ['müraciətin nömrəsini yoxladı.', 'sənədin surətini göndərdi.', 'hesabatın tarixini dəqiqləşdirdi.']],
  ['bank', ['Bankın əməkdaşı', 'Müştəri nümayəndəsi', 'Filialın rəhbəri', 'Maliyyə mütəxəssisi', 'Kredit mütəxəssisi'], ['ödənişin məbləğini yoxladı.', 'müqavilənin şərtlərini izah etdi.', 'müştərinin müraciətini cavablandırdı.']],
  ['software', ['Backend mütəxəssisi', 'Proqramçı', 'Test mühəndisi', 'Layihənin rəhbəri', 'Sistem inzibatçısı'], ['API cavabını yoxladı.', 'yeni modulun kodunu nəzərdən keçirdi.', 'xəta haqqında məlumatı komandaya göndərdi.']],
  ['security', ['Təhlükəsizlik mütəxəssisi', 'Şəbəkə inzibatçısı', 'Texniki rəhbər', 'Növbətçi mühəndis', 'Audit əməkdaşı'], ['giriş qeydlərini yoxladı.', 'istifadəçinin icazələrini nəzərdən keçirdi.', 'şəbəkə haqqında hesabat hazırladı.']],
  ['email', ['Katib', 'Şirkətin nümayəndəsi', 'Layihə meneceri', 'İnsan resursları mütəxəssisi', 'Dəstək əməkdaşı'], ['görüşün vaxtını məktubla bildirdi.', 'sorğunun cavabını elektron poçtla göndərdi.', 'müraciətin alındığını təsdiqlədi.']],
  ['science', ['Alim', 'Laboratoriyanın rəhbəri', 'Universitetin əməkdaşı', 'Gənc mühəndis', 'Tədqiqat qrupunun üzvü'], ['təcrübənin nəticələrini müqayisə etdi.', 'ölçmə cihazını yoxladı.', 'yeni tədqiqatın planını hazırladı.']],
  ['culture', ['Muzeyin əməkdaşı', 'Sərginin rəhbəri', 'Sənətşünas', 'Kitabxananın işçisi', 'Mədəniyyət mərkəzinin nümayəndəsi'], ['tədbirin proqramını təqdim etdi.', 'qonaqların suallarını cavablandırdı.', 'sərgi haqqında məlumat hazırladı.']],
  ['travel', ['Səyahətçi', 'Turist', 'Bələdçi', 'Səfərin təşkilatçısı', 'Qrupun rəhbəri'], ['şəhərin xəritəsini nəzərdən keçirdi.', 'muzeyə gedən yolu öyrəndi.', 'səfərin vaxtını dəqiqləşdirdi.']],
  ['agriculture', ['Fermer', 'Bağban', 'Kənd təsərrüfatı mütəxəssisi', 'Təsərrüfatın rəhbəri', 'Sahənin işçisi'], ['suvarma sistemini yoxladı.', 'məhsulun keyfiyyətini qiymətləndirdi.', 'yeni əkin planını hazırladı.']],
  ['environment', ['Ekoloq', 'Meşə işçisi', 'Parkın əməkdaşı', 'Təbiət könüllüsü', 'Ətraf mühit mütəxəssisi'], ['ağacların vəziyyətini yoxladı.', 'ərazidəki tullantıları topladı.', 'su mənbəyini müşahidə etdi.']],
  ['sport', ['Məşqçi', 'İdmançı', 'Komandanın kapitanı', 'İdman zalının rəhbəri', 'Fitnes mütəxəssisi'], ['məşqin planını nəzərdən keçirdi.', 'yeni hərəkəti izah etdi.', 'yarışın nəticələrini müzakirə etdi.']],
  ['home', ['Anam', 'Atam', 'Bacım', 'Qardaşım', 'Dostum'], ['pəncərəni açdı.', 'kitabları rəfə düzdü.', 'axşam yeməyini hazırladı.']],
  ['shopping', ['Alıcı', 'Satıcı', 'Mağazanın rəhbəri', 'Kassir', 'Anbarın əməkdaşı'], ['məhsulun qiymətini yoxladı.', 'sifarişin nömrəsini qeyd etdi.', 'malların siyahısını hazırladı.']],
  ['transport', ['Sürücü', 'Dispetçer', 'Nəqliyyat mütəxəssisi', 'Marşrutun rəhbəri', 'Daşıma şirkətinin əməkdaşı'], ['avtobusun gəliş vaxtını yoxladı.', 'səfərin cədvəlini yenilədi.', 'yol haqqında məlumat topladı.']],
  ['law', ['Hüquqşünas', 'Vəkil', 'Notarius', 'Hüquq şöbəsinin əməkdaşı', 'Məhkəmənin nümayəndəsi'], ['sənədin məzmununu oxudu.', 'müraciətin tarixini yoxladı.', 'qərarın surətini göndərdi.']],
  ['planning', ['Biznes analitiki', 'Məhsul meneceri', 'Komandanın rəhbəri', 'Layihənin koordinatoru', 'Şirkətin əməkdaşı'], ['işlərin ardıcıllığını müəyyən etdi.', 'yeni təklifləri müzakirə etdi.', 'gələn həftənin planını hazırladı.']],
  ['publishing', ['Redaktor', 'Jurnalist', 'Məqalənin müəllifi', 'Nəşriyyatın əməkdaşı', 'Jurnalın rəhbəri'], ['mətnin başlığını yoxladı.', 'yeni məqaləni nəzərdən keçirdi.', 'oxucunun sualını cavablandırdı.']],
  ['municipal', ['Bələdiyyənin əməkdaşı', 'İcra nümayəndəsi', 'Kommunal xidmətin işçisi', 'Şəhər planlaşdırma mütəxəssisi', 'Yaşayış binasının nümayəndəsi'], ['sakinlərin müraciətini qeyd etdi.', 'ərazinin xəritəsini yoxladı.', 'təmir işlərinin planını hazırladı.']],
];
const ascii: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ç: 'c', ş: 's', ğ: 'g', Ə: 'E', İ: 'I', Ö: 'O', Ü: 'U', Ç: 'C', Ş: 'S', Ğ: 'G' };
const digraph: Record<string, string> = { ...ascii, ç: 'ch', ş: 'sh', ğ: 'gh', Ç: 'Ch', Ş: 'Sh', Ğ: 'Gh' };
const cases = groups.flatMap(([domain, subjects, predicates]) => subjects.flatMap(subject => predicates.map(predicate => {
  const expected = subject + ' ' + predicate;
  return { domain, expected };
}))).map(({ domain, expected }, index) => {
  const mode = index % 5;
  const map = mode === 1 ? digraph : ascii;
  const input = mode === 0 ? expected : expected.replace(/[əıöüçşğƏİÖÜÇŞĞ]/gu, c => map[c]).replace(/\.$/u, '');
  return { id: 'release-holdout-' + String(index + 1).padStart(3, '0'), module: 'text' as const, input, actual: '', expected,
    preserveFormatting: false, reviewedAt: '2026-10-05T00:00:00Z', domain,
    provenance: 'assistant-authored compositional sentence; not human-reviewed', category: mode === 0 ? 'identity' : mode === 1 ? 'digraph' : 'diacritics' };
});
if (cases.length !== 300 || new Set(cases.map(row => row.expected)).size !== 300) throw new Error('Require 300 distinct targets.');
const path = 'tests/fixtures/release-holdout-300.json';
if (existsSync(path)) throw new Error('Frozen holdout already exists; refusing to replace it.');
mkdirSync('tests/fixtures', { recursive: true });
const bytes = JSON.stringify({ kind: 'slothai-reviewed-tests', version: 1, certification: 'assistant-authored, compositional engineering holdout, not real/human/linguist certified', cases }, null, 2) + '\n';
writeFileSync(path, bytes);
writeFileSync(path + '.sha256', createHash('sha256').update(bytes).digest('hex') + '\n');
console.log('Frozen 300 distinct sentences; 60 identity, 60 digraph, 180 diacritics.');
