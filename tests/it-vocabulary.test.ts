import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

test('source-derived technical forms and sentence boundaries work in an IT paragraph', () => {
  const source = 'proqramcilar sistemdeki melumatlari kompüterlerde saxlayirlar serverlerde tehlukesizlik parametrləri duzgun konfiqurasiya edilmelidir sifrelənmis verilenler şebeke uzerinden oturulur';
  const expected = 'Proqramçılar sistemdəki məlumatları kompüterlərdə saxlayırlar. Serverlərdə təhlükəsizlik parametrləri düzgün konfiqurasiya edilməlidir. Şifrələnmiş verilənlər şəbəkə üzərindən ötürülür.';
  assert.equal(correctText(source).text, expected);
  assert.equal(correctText(expected).text, expected);
});
