import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const requireTools = createRequire(option('tools') ? path.resolve(option('tools'), 'package.json') : path.join(root, 'package.json'));
const { chromium } = requireTools('playwright');
const esbuild = requireTools('esbuild');

async function main() {
  const dist = await mkdtemp(path.join(tmpdir(), 'slothai-async-'));
  const files = new Map([['/', 'index.html'], ['/harness.js', 'harness.js'], ['/editor.worker.js', 'editor.worker.js']]);
  const server = createServer(async (request, response) => {
    const file = files.get(request.url);
    if (!file) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
      response.end(await readFile(path.join(dist, file)));
    } catch { response.writeHead(500).end(); }
  });
  let browser;
  try {
    for (const [entry, output] of [['lib/workers/editor.worker.ts', 'editor.worker.js'], ['scripts/async-editor/benchmark.ts', 'harness.js']]) {
      await esbuild.build({ absWorkingDir: root, entryPoints: [entry], outfile: path.join(dist, output),
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
    }
    await writeFile(path.join(dist, 'index.html'), '<!doctype html><html lang="az"><meta charset="utf-8"><title>Async worker benchmark</title><script type="module" src="/harness.js"></script></html>');
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    browser = await chromium.launch({ ...(option('browser') ? { executablePath: option('browser') } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.benchmark === 'function');
    const result = await page.evaluate(() => window.benchmark());
    assert.deepEqual(errors, []);
    assert.equal(result.serialWorkers, 1); assert.equal(result.parallelWorkers, 2);
    assert.equal(result.overlapped, true); assert.equal(result.outputsIdentical, true);
    const report = { ...result, browser: await browser.version(), browserErrors: errors, measuredAtUTC: new Date().toISOString() };
    const out = path.resolve(option('out') ?? '/tmp/slothai-async-benchmark.json');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(dist, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
