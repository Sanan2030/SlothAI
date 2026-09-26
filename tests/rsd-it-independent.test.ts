import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';

const examples = [
  ['rsd de sened novu secilmeden muraciet gonderile bilmir', 'RSD-də sənəd növü seçilmədən müraciət göndərilə bilmir.'],
  ['rsd sisteminde qeydiyyat nomresi avtomatik yaranirmi', 'RSD sistemində qeydiyyat nömrəsi avtomatik yaranırmı?'],
  ['eger sened novu xidmeti olarsa elave saheler acilsin', 'Əgər sənəd növü xidmət olarsa, əlavə sahələr açılsın.'],
  ['bir nece sened novu eyni workflow dan istifade edir', 'Bir neçə sənəd növü eyni workflow-dan istifadə edir.'],
  ['gelecek senedler arxiv bolmesine kecirilmelidir', 'Gələcək sənədlər arxiv bölməsinə keçirilməlidir.'],
  ['senedlerin sureti elektron arxivde saxlanilir', 'Sənədlərin surəti elektron arxivdə saxlanılır.'],
  ['istifadeci derkenari tesdiqledi amma sened statusu deyismedi', 'İstifadəçi dərkənarı təsdiqlədi, amma sənəd statusu dəyişmədi.'],
  ['sened aidiyyeti uzre gonderildi icraci ise tesdiq merhelesindedir', 'Sənəd aidiyyəti üzrə göndərildi. İcraçı isə təsdiq mərhələsindədir.'],
  ['api sorgulari suretle cavablandirilir', 'API sorğuları sürətlə cavablandırılır.'],
  ['router bir nece cihazi sebekeye qosdu', 'Router bir neçə cihazı şəbəkəyə qoşdu.'],
  ['git tarixcesinde yeni commit gorunur', 'Git tarixçəsində yeni commit görünür.'],
  ['deploy merhelesi ugurla basa catdi', 'Deploy mərhələsi uğurla başa çatdı.'],
  ['srs senedinde bpmn diaqrami uat meyarlari ve api contract yenilenib', 'SRS sənədində BPMN diaqramı, UAT meyarları və API contract yenilənib.'],
  ['rsd sisteminde 3 merhele var 1) qeydiyyat 2) razilasdirma 3) icra', 'RSD sistemində 3 mərhələ var:\n1. Qeydiyyat.\n2. Razılaşdırma.\n3. İcra.'],
  ['jira taski confluence sehifesi ile elaqelendirilib', 'Jira taskı Confluence səhifəsi ilə əlaqələndirilib.'],
] as const;
for (const [input, expected] of examples) {
  test(`RSD/IT text: ${input}`, () => {
    assert.equal(correctText(input).text, expected);
    assert.equal(correctText(expected).text, expected);
  });
}

test('technical acronyms and foreign terms remain readable', () => {
  const output = correctText('GET /api/v1/documents endpointi productionda 500 qaytarir amma stagingde isleyir').text;
  assert.match(output, /GET \/api\/v1\/documents/u);
  assert.match(output, /endpoint-i/u);
  assert.match(output, /production-da/u);
  assert.match(output, /staging-də/u);
  assert.match(output, /, amma/u);
});
