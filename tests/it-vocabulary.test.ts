import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

test('source-derived technical forms and sentence boundaries work in an IT paragraph', () => {
  const source = 'proqramcilar sistemdeki melumatlari kompüterlerde saxlayirlar serverlerde tehlukesizlik parametrləri duzgun konfiqurasiya edilmelidir sifrelənmis verilenler şebeke uzerinden oturulur';
  const expected = 'Proqramçılar sistemdəki məlumatları kompüterlərdə saxlayırlar. Serverlərdə təhlükəsizlik parametrləri düzgün konfiqurasiya edilməlidir. Şifrələnmiş verilənlər şəbəkə üzərindən ötürülür.';
  assert.equal(correctText(source).text, expected);
  assert.equal(correctText(expected).text, expected);
});

test('technical phrases preserve their intended terms and do not translate English identifiers', () => {
  const source = 'backendde database sorgulari optimallasdirilir api keys ve oauth2 ile avtorizasiya edilir ci cd boru xetleri deployment prosesini avtomatlasdirir';
  const output = correctText(source).text;
  for (const phrase of ['Backenddə database sorğuları optimallaşdırılır.', 'API keys və OAuth2 ilə avtorizasiya edilir.', 'CI/CD boru xətləri deployment prosesini avtomatlaşdırır.']) {
    assert.ok(output.includes(phrase), phrase);
  }
  assert.equal(correctText(output).text, output);
});
