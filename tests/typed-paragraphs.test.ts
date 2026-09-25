import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';

const passages = [
  ['Komanda bu gün layihəni müzakirə etdi. Texniki sənədlər hazırlandı. Axşam hava soyudu. Evə qayıtdım.',
    'Komanda bu gün layihəni müzakirə etdi. Texniki sənədlər hazırlandı.\n\nAxşam hava soyudu. Evə qayıtdım.'],
  ['Yeni server quruldu. Sistem dünən yoxlandı. Şəbəkə bu gün işlədi. Kod da hazırdır.',
    'Yeni server quruldu. Sistem dünən yoxlandı. Şəbəkə bu gün işlədi. Kod da hazırdır.'],
  ['Səhər avtobusa mindim. Dostumla şəhəri gəzdik. Günortadan sonra yağış başladı.',
    'Səhər avtobusa mindim. Dostumla şəhəri gəzdik.\n\nGünortadan sonra yağış başladı.'],
] as const;
for (const [input, expected] of passages) test(`paragraph flow: ${input.slice(0, 35)}`, () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});
