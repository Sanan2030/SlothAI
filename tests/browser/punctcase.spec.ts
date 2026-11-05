import { expect, test } from '@playwright/test';
import weights from '../../lib/editor/punctcase/weights.json';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function scriptsUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? scriptsUnder(join(directory, entry.name)) : entry.name.endsWith('.js') ? [join(directory, entry.name)] : []);
}

test('both models run automatically in text and mail without an activation control', async ({ page, context }) => {
  const apiRequests: string[] = [];
  context.on('request', request => { if (request.url().includes('/api/transform')) apiRequests.push(request.url()); });
  const workerResources = async () => (await Promise.all(page.workers().map(worker =>
    worker.evaluate(() => performance.getEntriesByType('resource').map(resource => resource.name))))).flat();
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: /PunctCase/u })).toHaveCount(0);
  await expect(page.getByText('PunctCase — durğu və registr (sınaq)', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill('qeyd edək ki bu məsələ hələ araşdırılır');
  await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toHaveText('Qeyd edək ki, bu məsələ hələ araşdırılır.');
  const marker = weights.data.slice(512, 640), root = resolve('.next/static/chunks');
  const weightChunks = scriptsUnder(root).filter(file => readFileSync(file, 'utf8').includes(marker))
    .map(file => relative(root, file).replaceAll('\\', '/'));
  expect(weightChunks.length).toBeGreaterThan(0);
  expect((await workerResources()).some(url => weightChunks.some(chunk => new URL(url).pathname.endsWith('/' + chunk)))).toBe(true);
  const latest = await page.evaluate(() => JSON.parse(localStorage.getItem('slothai-transform-log-v1') ?? '[]').at(-1));
  expect(latest.modelUsage.wordLM.mode).toBe('automatic');
  expect(latest.modelUsage.wordLM.scoredTokens).toBeGreaterThanOrEqual(7);
  expect(latest.modelUsage.wordLM.vocabularyWords).toBe(150000);
  expect(latest.modelUsage.punctCase.mode).toBe('automatic');
  expect(latest.modelUsage.punctCase.applied).toBe(1);
  expect(latest.usePunctCase).toBeUndefined();
  await page.getByRole('button', { name: 'Mail Düzəldici', exact: true }).click();
  await page.getByRole('textbox', { name: 'Qaralama', exact: true }).fill('qeyd edək ki bu məsələ hələ araşdırılır');
  await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toContainText('ki, bu məsələ');
  const mail = await page.evaluate(() => JSON.parse(localStorage.getItem('slothai-transform-log-v1') ?? '[]').at(-1));
  expect(mail.module).toBe('mail');
  expect(mail.modelUsage.wordLM.mode).toBe('automatic');
  expect(mail.modelUsage.punctCase.loaded).toBe(true);
  expect(apiRequests).toEqual([]);
});

test('automatic inference preserves punctuation, markup and literal bytes on repeated processing', async ({ page }) => {
  await page.goto('/');
  const cases = [
    ['Mən bilirəm ki, sən sabah gələcəksən.', 'Mən bilirəm ki, sən sabah gələcəksən.'],
    ['**qeyd edək ki bu məsələ hələ araşdırılır**', '**Qeyd edək ki, bu məsələ hələ araşdırılır**.'],
    ['> qeyd edək ki bu məsələ hələ araşdırılır', '> Qeyd edək ki, bu məsələ hələ araşdırılır.'],
    ['[qeyd edək ki bu məsələ hələ araşdırılır](/guide)', '[Qeyd edək ki, bu məsələ hələ araşdırılır](/guide).'],
  ];
  for (const [source, expected] of cases) {
    await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill(source);
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await expect(page.locator('.workspace-output pre')).toHaveText(expected);
    await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill(expected);
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await expect(page.locator('.workspace-output pre')).toHaveText(expected);
  }
});
