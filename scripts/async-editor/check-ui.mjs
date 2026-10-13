import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const requireTools = createRequire(option('tools') ? path.resolve(option('tools'), 'package.json') : path.join(root, 'package.json'));
const { chromium } = requireTools('playwright');

async function scenario(browser, profile, failText = false) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ cores, memoryGB }) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => cores });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => memoryGB });
    const NativeWorker = window.Worker;
    const hook = { workers: [], requests: [], held: [], hold: true };
    window.__workerCheck = hook;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        const workerIndex = hook.workers.length;
        hook.workers.push(this);
        const post = this.postMessage.bind(this);
        this.postMessage = request => {
          if (request.strategyId) hook.requests.push({ ...request, workerIndex });
          post(request);
        };
        this.addEventListener('message', event => {
          if (hook.hold && Number.isSafeInteger(event.data.id)) {
            event.stopImmediatePropagation();
            hook.held.push({ workerIndex, data: event.data });
          }
        });
      }
    };
  }, profile);
  try {
    await page.goto(option('url') ?? 'http://127.0.0.1:3132', { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill('men bu gun mektebe getdim');
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await page.waitForFunction(() => window.__workerCheck.requests.length === 1);
    await page.getByRole('button', { name: 'Mail Düzəldici', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Qaralama', exact: true }).isEnabled(), true);
    await page.getByRole('textbox', { name: 'Qaralama', exact: true }).fill('hesabat hazirdir');
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    const parallel = profile.cores >= 8 && profile.memoryGB >= 8;
    if (parallel) {
      await page.waitForFunction(() => window.__workerCheck.requests.length === 2);
      await page.waitForFunction(() => window.__workerCheck.held.length === 2);
    } else {
      await page.waitForFunction(() => window.__workerCheck.held.length === 1);
      assert.equal(await page.evaluate(() => window.__workerCheck.requests.length), 1);
      await page.evaluate(() => {
        const hook = window.__workerCheck, item = hook.held.shift();
        hook.workers[item.workerIndex].onmessage(new MessageEvent('message', { data: item.data }));
      });
      await page.waitForFunction(() => window.__workerCheck.requests.length === 2 && window.__workerCheck.held.length === 1);
    }
    if (failText) await page.evaluate(() => {
      const hook = window.__workerCheck;
      const text = hook.requests.find(request => request.strategyId === 'text-corrector');
      hook.workers[text.workerIndex].dispatchEvent(new ErrorEvent('error', { message: 'test worker failure' }));
    });
    const requests = await page.evaluate(() => window.__workerCheck.requests.map(request => ({ strategyId: request.strategyId, workerIndex: request.workerIndex })));
    await page.evaluate(() => {
      const hook = window.__workerCheck;
      hook.hold = false;
      for (const item of hook.held.splice(0).sort((a, b) => b.data.id - a.data.id)) hook.workers[item.workerIndex].onmessage(new MessageEvent('message', { data: item.data }));
    });
    await page.waitForFunction(() => document.querySelector('.workspace-run-btn')?.textContent.trim() === 'Düzəlt');
    const mailOutput = await page.locator('.workspace-output pre').textContent();
    assert.match(mailOutput, /Hesabat hazırdır\./u);
    assert.equal(await page.locator('.workspace-error[role="alert"]').count(), 0);
    await page.getByRole('button', { name: 'Mətn Düzəldici', exact: true }).click();
    let textOutput;
    if (failText) {
      await page.locator('.workspace-error[role="alert"]').waitFor();
      assert.match(await page.locator('.workspace-error[role="alert"]').textContent(), /Yerli mühərrik açılmadı/u);
      textOutput = 'failure isolated to text module';
    } else {
      textOutput = await page.locator('.workspace-output pre').textContent();
      assert.equal(textOutput, 'Mən bu gün məktəbə getdim.');
    }
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('slothai-transform-log-v1') ?? '[]'));
    assert.equal(log.length, failText ? 1 : 2);
    assert.equal(log.find(entry => entry.module === 'mail')?.input, 'hesabat hazirdir');
    if (!failText) assert.equal(log.find(entry => entry.module === 'text')?.input, 'men bu gun mektebe getdim');
    assert.deepEqual(errors, []);
    return { profile, parallel, requests, outputsRouted: true, logsRouted: true, failureIsolated: failText,
      textOutput, mailOutput, browserErrors: errors };
  } finally { await context.close(); }
}

async function main() {
  const browser = await chromium.launch({ ...(option('browser') ? { executablePath: option('browser') } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const scenarios = [];
    scenarios.push(await scenario(browser, { cores: 8, memoryGB: 8 }));
    scenarios.push(await scenario(browser, { cores: 2, memoryGB: 2 }));
    scenarios.push(await scenario(browser, { cores: 8, memoryGB: 8 }, true));
    const report = { measuredAtUTC: new Date().toISOString(), browser: await browser.version(),
      productionApp: true, note: 'Worker results were held until both UI requests were submitted to exercise pending work and out-of-order routing.', scenarios };
    const out = path.resolve(option('out') ?? '/tmp/slothai-async-ui.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
