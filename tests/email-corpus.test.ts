import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatEmail } from '../lib/editor/correct';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';

const recipients = ['musteri numayendesi', 'korporativ musteri', 'deyerli terefdasimiz', 'xidmet istifadecisi'];
const events = ['sorgunuz', 'muracietiniz', 'texniki destek telebiniz', 'hesabinizla bagli sualiniz', 'inteqrasiya telebiniz'];
const statuses = ['sistemde qebul edildi', 'qeydiyyata alindi', 'muafiq komanda terefinden arasdirilir', 'tezlikle yoxlanilacaq', 'en qisa muddetde cavablandirilacaq'];
const requests = ['tesekkur edirik', 'elave sualiniz olsa bizimle elaqe saxlayin', 'size netice barede melumat vereceyik', 'zehmet olmasa cavabimizi gozleyin', 'size komek etmekden memnunuq'];

test('one thousand customer-response email variations pass through the app strategy with stable structure', async () => {
  const strategy = getStrategyRegistry().get('gmail-corrector');
  for (let index = 0; index < 1_000; index++) {
    const input = `hormetli ${recipients[index % recipients.length]}\n${events[(index * 3) % events.length]} ${statuses[(index * 7) % statuses.length]}. ${requests[(index * 11) % requests.length]}`;
    const result = await strategy.transform({ text: input });
    const output = result.transformedText;
    assert.equal(result.metadata.strategyUsed, 'gmail-corrector');
    assert.match(output, /^Mövzu: .+\n\nHörmətli .+,\n\n[\s\S]+\n\nHörmətlə,$/u, String(index));
    assert.doesNotMatch(output, /\b(hormetli|musteri|numayendesi|terefdasimiz|sorgunuz|muracietiniz|qebul|zehmet|tesekkur|elaqe)\b/iu, String(index));
    assert.equal(formatEmail(output).text, output, String(index));
  }
});
