/** Frozen assistant-authored development audit through the actual app strategies. */
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadNovelCorpus } from './corpus';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getStrategyRegistry } from '../../lib/strategies/bootstrap';
import { foldLetters } from '../../lib/editor/dictionary';
import type { TransformationOptions } from '../../lib/strategies/types';

export interface NovelCase {
  id: string; domain: string; module: 'mail' | 'text'; variant: string;
  input: string; expected: string; options: TransformationOptions;
}
const argument = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
// Email blank-line layout and harmless whitespace are not spelling errors.
export const comparable = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
const letters = (text: string) => (text.normalize('NFC').match(/[\p{L}\p{N}_]+/gu) ?? []).join(' ');

function reason(row: NovelCase, output: string): { category: string; why: string } {
  const wanted = comparable(row.expected), actual = comparable(output);
  if (row.variant === 'identity') return { category: 'changed-correct-input', why: 'Əvvəlcədən düzgün yazılmış mətn gözlənilən dil formasından uzaqlaşdırılıb.' };
  if (foldLetters(letters(wanted)) === foldLetters(letters(actual)) && letters(wanted) !== letters(actual)) {
    return { category: 'diacritics-or-case', why: 'Sözlərin əsas hərf ardıcıllığı uyğun gəlir, amma Azərbaycan hərfi və ya böyük/kiçik hərf düzgün bərpa olunmayıb.' };
  }
  if (letters(wanted).toLocaleLowerCase('az-AZ') === letters(actual).toLocaleLowerCase('az-AZ')) {
    return { category: 'punctuation-or-layout', why: 'Sözlər qorunub, amma cümlə sərhədi, durğu və ya mail quruluşu gözləniləndən fərqlənir; üslub alternativi ayrıca nəzərdən keçirilməlidir.' };
  }
  if (row.variant === 'spacing') return { category: 'missing-word-boundary', why: 'Bağlayıcıdan əvvəl itmiş söz sərhədi düzgün ayrılmayıb və ya ayrılma zamanı söz zədələnib.' };
  if (row.variant === 'repeated-key') return { category: 'typo-or-wrong-candidate', why: 'Təkrar düymə səhvi qalıb və ya bərpa zamanı yanlış söz namizədi seçilib.' };
  return { category: 'unresolved-or-wrong-word', why: 'Ən az bir söz saxlanılmalı düzgün formadan fərqlənir: namizəd tapılmayıb və ya uyğun olmayan əvəzləmə tətbiq olunub.' };
}

async function main() {
  const corpus = resolve(argument('corpus') ?? 'data/qa/novel-10000-2026-11-04');
  const output = resolve(argument('out') ?? 'artifacts/qa/novel-10000-20261104/baseline');
  const loaded = loadNovelCorpus(corpus), manifest = loaded.manifest;
  let rows = loaded.rows;
  if (rows.length !== 10000 || new Set(rows.map(row => row.input)).size !== 10000) throw new Error('Incomplete or duplicate corpus');
  const idsFile = argument('ids');
  if (idsFile) { const ids = new Set(JSON.parse(readFileSync(idsFile, 'utf8')) as string[]); rows = rows.filter(row => ids.has(row.id)); }
  mkdirSync(output, { recursive: false });
  const resultPath = `${output}/results.jsonl`, ledgerPath = `${output}/errors.jsonl`;
  writeFileSync(resultPath, ''); writeFileSync(ledgerPath, '');
  const summary: Record<string, { cases: number; exact: number; unstable: number; errors: number; charSpellLoaded: number; charSpellRankedTokens: number; charSpellCandidatesScored: number; punctCaseLoaded: number; punctCaseApplied: number; categories: Record<string, number>; domains: Record<string, { cases: number; exact: number }> }> = {};
  for (const mode of ['default', 'punctcase']) summary[mode] = { cases: 0, exact: 0, unstable: 0, errors: 0, charSpellLoaded: 0, charSpellRankedTokens: 0, charSpellCandidatesScored: 0, punctCaseLoaded: 0, punctCaseApplied: 0, categories: {}, domains: {} };
  const runtimePaths = execFileSync('rg', ['--files', 'lib/editor', 'lib/strategies'], { encoding: 'utf8' }).trim().split('\n').filter(path => path.endsWith('.ts')).sort();
  const runtimeSHA256 = Object.fromEntries(runtimePaths.map(path => [path, sha(readFileSync(path))]));
  const workingDiffSHA256 = sha(execFileSync('git', ['diff', '--', 'lib/editor', 'lib/strategies'], { maxBuffer: 32 * 1024 * 1024 }));
  const started = performance.now();
  for (const [at, row] of rows.entries()) {
    for (const mode of ['default', 'punctcase']) {
      const totals = summary[mode], strategy = getStrategyRegistry().get(row.module === 'mail' ? 'gmail-corrector' : 'text-corrector');
      const options = { ...row.options, ...(mode === 'punctcase' ? { usePunctCase: true } : {}) };
      let actual = '', repeated = '', error: string | undefined, metadata: unknown;
      try {
        const result = await strategy.transform({ text: row.input, options });
        actual = result.transformedText; metadata = result.metadata;
        totals.charSpellLoaded += Number(result.metadata.charSpell?.loaded === true);
        totals.charSpellRankedTokens += result.metadata.charSpell?.rankedTokens ?? 0;
        totals.charSpellCandidatesScored += result.metadata.charSpell?.candidatesScored ?? 0;
        totals.punctCaseLoaded += Number(result.metadata.punctCase?.loaded === true);
        totals.punctCaseApplied += result.metadata.punctCase?.applied ?? 0;
        repeated = (await strategy.transform({ text: actual, options })).transformedText;
      } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
      const exact = !error && comparable(actual) === comparable(row.expected);
      const stable = !error && comparable(repeated) === comparable(actual);
      const record = { ...row, mode, actual, repeated, exact, stable, ...(error ? { error } : {}), metadata };
      appendFileSync(resultPath, JSON.stringify(record)+'\n');
      totals.cases++; totals.exact += Number(exact); totals.unstable += Number(!stable); totals.errors += Number(Boolean(error));
      const domain = totals.domains[row.domain] ??= { cases: 0, exact: 0 }; domain.cases++; domain.exact += Number(exact);
      if (!exact || !stable) {
        const diagnosis = error ? { category: 'exception', why: 'Tətbiqin düzəliş axını sorğunu tamamlamayıb.' } : !stable && exact
          ? { category: 'non-idempotent', why: 'Eyni nəticə ikinci dəfə düzəldiləndə dəyişir.' } : reason(row, actual);
        totals.categories[diagnosis.category] = (totals.categories[diagnosis.category] ?? 0)+1;
        appendFileSync(ledgerPath, JSON.stringify({ ...record, ...diagnosis, diagnosisStatus: 'automatic-triage-needs-root-cause-review' })+'\n');
      }
    }
    if ((at+1) % 250 === 0) {
      const progress = { completed: at+1, total: rows.length, elapsedSeconds: (performance.now()-started)/1000,
        exactDefault: summary.default.exact, exactPunctCase: summary.punctcase.exact };
      writeFileSync(`${output}/progress.json`, JSON.stringify(progress, null, 2)+'\n'); console.log(JSON.stringify(progress));
    }
  }
  const report = { scope: '10,000 new assistant-authored development cases through app strategy entry points; not real-user accuracy or blind acceptance.',
    corpusSHA256: manifest.corpusSHA256, goldReviewSHA256: loaded.goldReviewSHA256, reviewedTargetsSHA256: loaded.reviewedTargetsSHA256,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingDiffSHA256, runtimeSHA256,
    completedAtUTC: new Date().toISOString(), elapsedSeconds: (performance.now()-started)/1000, totalDistinctInputs: rows.length,
    totalAppTransformations: rows.length*4, comparison: 'NFC and whitespace normalization only; no automatic gold rewriting.', summary,
    resultsSHA256: sha(readFileSync(resultPath)), errorsSHA256: sha(readFileSync(ledgerPath)) };
  for (const path of [resultPath, ledgerPath]) writeFileSync(path+'.gz', gzipSync(readFileSync(path)));
  writeFileSync(`${output}/summary.json`, JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify({ ...report, runtimeSHA256: `recorded ${runtimePaths.length} source hashes` }, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
