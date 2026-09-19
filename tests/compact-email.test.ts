import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
import { formatEmail } from '../lib/editor/correct';

const cases = [
  ['abb mobile sprint 14 yekunlari', 'hormetli layihe heyeti ve maraqli terefler', 'kecen iki hefte erzinde sprint yekunlasmisdir', 'resad eliyev aparici layihe meneceri'],
  ['insident hesabati', 'hormetli texniki rehberlik', '18 sentyabr tarixinde kesinti bas vermisdir', 'senan nebizade sistem arxitektoru'],
  ['tesdiq ucun srs senedi', 'hormetli mehsul sahibi ve biznes komandasi', 'evvelki goruslerimizde telebleri muzakire etdik', 'leyla qasimova biznes analitik'],
  ['ise qebul teklifi', 'hormetli tural bey', 'sirketimizde sizi analitik vezifesinde gormek isteyirik', 'nermin memmedova insan resurslari mudiri'],
  ['sla pozuntusu', 'hormetli elvin bey', 'sirketinizin unvanladigi sikayet arasdirilmisdir', 'ferid huseynov direktor'],
  ['budce tesdiq sorgusu', 'hormetli maliyye komitesi ve idare heyeti', 'it ve reqemsallasma budcesi teqdim edilir', 'elnur qasimov maliyye analitiki'],
  ['tehlukesizlik elani', 'hormetli emekdaslar', 'son zamanlar fisinq hucumlari artmisdir', 'informasiya tehlukesizliyi departamenti'],
  ['kommersiya teklifi', 'hormetli murad bey', 'sizinle kecen hefte tanis olmaqdan memnun olduq', 'aysel memmedova satis meneceri'],
  ['yeni ofise kocme', 'hormetli emekdaslar', 'bildirmekden memnunluq duyuruq ki yeni ofise kocuruk', 'inzibati isler departamenti'],
  ['korporativ telim', 'hormetli emekdaslar', 'sirketimizin daxili telim proqrami baslayir', 'telim ve inkisaf merkezi'],
] as const;

test('dense business emails are split into subject, greeting, body and one signature', async () => {
  const strategy = getStrategyRegistry().get('gmail-corrector');
  for (const [subject, greeting, body, signature] of cases) {
    const output = (await strategy.transform({
      text: `${subject} ${greeting} ${body} hormetle ${signature}`,
    })).transformedText;
    assert.match(output, /^Mövzu: (?!Müraciət).+\n\nHörmətli .+,\n\n[\s\S]+\n\nHörmətlə,\n.+$/u);
    assert.equal((output.match(/^Hörmətlə,/gmu) ?? []).length, 1);
    assert.equal((output.match(/^Mövzu:/gmu) ?? []).length, 1);
    assert.doesNotMatch(output, /\n\nSalam,/u);
    assert.equal(formatEmail(output).text, output);
  }
});
