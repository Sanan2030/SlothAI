/** Diagnostic evaluation of two frozen, separately authored domain corpora. */
import { readFileSync, writeFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';

type RsdCase = { id: string; domain: string; input: string; anchor: string };
type EmailCase = { id: string; domain: string; audience: string; subject: string; anchor: string; input: string };
type Finding = { id: string; domain: string; input: string; actual: string; failures: string[] };
const read = <T>(name: string) => JSON.parse(readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url), 'utf8')) as T[];
const fold = (text: string) => text.toLocaleLowerCase('az-AZ')
  .replace(/[əıçğöşü]/gu, character => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[character] ?? character);
const rsd = read<RsdCase>('rsd-it-holdout.json');
const mail = read<EmailCase>('email-holdout.json');
if (rsd.length < 400 || mail.length < 300) throw new Error(`Corpus incomplete: ${rsd.length} RSD/IT, ${mail.length} email`);
if (new Set(rsd.map(item => item.input)).size !== rsd.length || new Set(mail.map(item => item.input)).size !== mail.length) {
  throw new Error('Duplicate input in independent corpora');
}

const rsdResults: Finding[] = rsd.map(item => {
  const actual = correctText(item.input).text;
  const failures = [];
  if (!fold(actual).includes(fold(item.anchor))) failures.push('semantic anchor lost');
  if (!/[.!?]$/u.test(actual)) failures.push('missing final punctuation');
  // Canonical brand spellings such as gRPC intentionally begin in lowercase.
  if (actual[0] !== actual[0]?.toLocaleUpperCase('az-AZ') && !/^gRPC\b/u.test(actual)) failures.push('missing initial capitalization');
  if (correctText(actual).text !== actual) failures.push('not idempotent');
  return { id: item.id, domain: item.domain, input: item.input, actual, failures };
});
const mailResults: Finding[] = mail.map(item => {
  const actual = formatEmail(item.input).text;
  const failures = [];
  if (!fold(actual).includes(fold(item.anchor))) failures.push('semantic anchor lost');
  if ((actual.match(/^Mövzu:/gmu) ?? []).length !== 1) failures.push('subject count');
  if (!/^Mövzu: [^\n]+\n\n(?:Hörmətli [^\n]+|Salam),\n\n/u.test(actual)) failures.push('salutation structure');
  if (!/^Mövzu: [^\n]+\n\nHörmətli [^\n]+,\n\n/u.test(actual)) failures.push('addressee lost');
  if (!actual.includes(`Mövzu: ${item.subject}`) && /^(?:Mövzu|movzu)/iu.test(item.input)) failures.push('subject changed');
  if ((actual.match(/^Hörmətlə,/gmu) ?? []).length !== 1) failures.push('closing count');
  if (formatEmail(actual).text !== actual) failures.push('not idempotent');
  return { id: item.id, domain: item.domain, input: item.input, actual, failures };
});
for (const [name, results] of [['rsd-it', rsdResults], ['email', mailResults]] as const) {
  const failures = results.filter(item => item.failures.length);
  const report = { total: results.length, passed: results.length - failures.length, failed: failures.length,
    domains: [...new Set(results.map(item => item.domain))], results };
  writeFileSync(new URL(`../docs/${name}-independent-results.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ name, total: report.total, passed: report.passed, failed: report.failed,
    failureExamples: failures.slice(0, 15) }, null, 2));
}
if (rsdResults.some(item => item.failures.length) || mailResults.some(item => item.failures.length)) process.exitCode = 1;
