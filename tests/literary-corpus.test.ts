import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

test('literary headings and established Azerbaijani constructions stay intact', () => {
  const source = 'AZƏRBAYCAN DİLİNDƏ HEKAYƏ MƏTNİ\n(On fəsildən ibarət, rəsmi üslubda yazılmış mətn)\n=== Fəsil 1: Zamanın İzi ===\nSəhərin ilk işığı torpağa düşdükdə, insan öz kiçikliyini bir daha dərk edir. Elmin inkişaf yolu izləndikdə, zəhmətsiz uğur qazanılmır, cəhalətin qaranlığı get-gedə çəkilir. Hər əl uzatma yeni bir körpü qurur. Xalq öz gələcəyini özü qurur. İnsan gələcəyi xəyal etməklə kifayətlənmir, onu qurur. İnsan pes etmədikcə, məğlub sayılmır.';
  assert.equal(correctText(source, true).text, source);
});
