/** Exercise every frozen case inside the production app's actual editor Worker. */
import { chromium } from '@playwright/test';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadNovelCorpus } from './corpus';
import { createHash } from 'node:crypto';
import type { TransformationResult } from '../../lib/strategies/types';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length+3);
const comparable = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
async function main() {
  const baseURL = argument('url') ?? 'http://127.0.0.1:3103';
  if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('This audit runs only against the local production build');
  const nodePath = argument('node-results');
  if (!nodePath) throw new Error('--node-results=/path/to/completed/results.jsonl is required');
  const out = argument('out') ?? 'artifacts/qa/novel-10000-20261104/browser';
  const corpus = 'data/qa/novel-10000-2026-11-04';
  const loaded = loadNovelCorpus(corpus), manifest = loaded.manifest, rows = loaded.rows;
  const requireAutomatic = process.argv.includes('--require-automatic');
  const requireCharSpell = process.argv.includes('--require-charspell');
  const legacyFalse = process.argv.includes('--legacy-false');
  const nodeResults = new Map(readFileSync(nodePath, 'utf8').trim().split('\n').map(line => {
    const row = JSON.parse(line); return [`${row.mode}:${row.id}`, row.actual as string];
  }));
  if (rows.length !== 10000 || nodeResults.size !== 20000) throw new Error('Incomplete corpus or Node comparison');
  mkdirSync(out, { recursive: false }); writeFileSync(`${out}/results.jsonl`, '');
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); let transformHTTPRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/transform') transformHTTPRequests++; });
    await page.addInitScript({ content: `
      globalThis.__name = (fn) => fn;
      window.__qaWorkers = [];
      window.Worker = new Proxy(window.Worker, { construct(Target, args) {
        const worker = Reflect.construct(Target, args), record = { worker, editor: false };
        worker.addEventListener('message', event => {
          if (Number.isSafeInteger(event.data?.id) && event.data?.result?.metadata?.strategyUsed) record.editor = true;
        });
        window.__qaWorkers.push(record); return worker;
      } });
    ` });
    await page.goto(baseURL);
    const probe = rows.find(row => row.module === 'text')!;
    await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill(probe.input);
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await page.locator('.workspace-output pre').waitFor();
    const probeOutput = await page.locator('.workspace-output pre').textContent();
    if (comparable(probeOutput ?? '') !== comparable(nodeResults.get(`default:${probe.id}`)!)) throw new Error('UI-to-Worker probe differs from Node app path');
    const totals = { default: { cases: 0, exact: 0, nodeParityDifferences: 0, exceptions: 0, charSpellModelRequests: 0, automaticModelRequests: 0 },
      punctcase: { cases: 0, exact: 0, nodeParityDifferences: 0, exceptions: 0, charSpellModelRequests: 0, automaticModelRequests: 0 } };
    const started = performance.now();
    for (const mode of ['default', 'punctcase'] as const) {
      for (let offset = 0; offset < rows.length; offset += 100) {
        const batch = rows.slice(offset, offset+100);
        const outputs = await page.evaluate(async ({ batch, mode, offset, legacyFalse }) => {
          const box = window as unknown as Window & { __qaWorkers: { worker: Worker; editor: boolean }[] };
          const editor = box.__qaWorkers.find(row => row.editor)?.worker;
          if (!editor) throw new Error('The app did not create its editor Worker');
          const results: { id: string; actual: string; automaticModels: boolean; charSpellLoaded: boolean; error?: string }[] = [];
          for (const [at, row] of batch.entries()) {
            const id = -1_000_000-offset-at-(mode === 'punctcase' ? 10000 : 0);
            const response = await new Promise<{ result?: TransformationResult; error?: string }>((resolve, reject) => {
              const timer = setTimeout(() => { editor.removeEventListener('message', listener); reject(new Error('Worker timeout')); }, 60000);
              const listener = (event: MessageEvent) => {
                if (event.data?.id !== id) return;
                clearTimeout(timer); editor.removeEventListener('message', listener); resolve(event.data);
              };
              editor.addEventListener('message', listener);
              editor.postMessage({ id, strategyId: row.module === 'mail' ? 'gmail-corrector' : 'text-corrector',
                request: { text: row.input, options: { ...row.options, ...(mode === 'punctcase' ? { usePunctCase: !legacyFalse } : {}) } } });
            });
            results.push({ id: row.id, actual: response.result?.transformedText ?? '',
              automaticModels: response.result?.metadata.wordLM?.mode === 'automatic' && response.result.metadata.wordLM.loaded
                && response.result.metadata.punctCase?.mode === 'automatic' && response.result.metadata.punctCase.loaded,
              charSpellLoaded: response.result?.metadata.charSpell?.loaded === true && response.result.metadata.charSpell.mode === 'automatic',
              ...(response.error ? { error: response.error } : {}) });
          }
          return results;
        }, { batch, mode, offset, legacyFalse });
        for (const [at, result] of outputs.entries()) {
          const row = batch[at], total = totals[mode]; total.cases++;
          const exact = !result.error && comparable(result.actual) === comparable(row.expected);
          const parity = result.actual === nodeResults.get(`${mode}:${row.id}`);
          total.exact += Number(exact); total.nodeParityDifferences += Number(!parity); total.exceptions += Number(Boolean(result.error));
          total.charSpellModelRequests += Number(result.charSpellLoaded);
          total.automaticModelRequests += Number(result.automaticModels);
          appendFileSync(`${out}/results.jsonl`, JSON.stringify({ mode, ...result, exact, nodeParity: parity })+'\n');
        }
        if ((offset+batch.length) % 500 === 0) console.log(JSON.stringify({ mode, completed: offset+batch.length, total: rows.length, elapsedSeconds: (performance.now()-started)/1000 }));
      }
    }
    const report = { scope: 'Production Chromium editor Worker, same instance created by app UI; 20,000 Worker requests, not 20,000 DOM clicks.',
      corpusSHA256: manifest.corpusSHA256, goldReviewSHA256: loaded.goldReviewSHA256, reviewedTargetsSHA256: loaded.reviewedTargetsSHA256,
      completedAtUTC: new Date().toISOString(), browserVersion: browser.version(),
      uiProbePassed: true, transformHTTPRequests, totals, elapsedSeconds: (performance.now()-started)/1000,
      requireAutomatic, requireCharSpell, legacyFalse,
      resultsSHA256: hash(readFileSync(`${out}/results.jsonl`)) };
    writeFileSync(`${out}/summary.json`, JSON.stringify(report, null, 2)+'\n');
    writeFileSync(`${out}/results.jsonl.gz`, gzipSync(readFileSync(`${out}/results.jsonl`)));
    console.log(JSON.stringify(report, null, 2));
    if (transformHTTPRequests || Object.values(totals).some(row => row.exceptions || row.nodeParityDifferences
      || requireAutomatic && row.automaticModelRequests !== row.cases || requireCharSpell && row.charSpellModelRequests !== row.cases)) process.exitCode = 1;
  } finally { await browser.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
