import { expect, test } from '@playwright/test';
import weights from '../../lib/editor/punctcase/weights.json';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function scriptsUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? scriptsUnder(join(directory, entry.name)) : entry.name.endsWith('.js') ? [join(directory, entry.name)] : []);
}

test('PunctCase loads only on explicit use and corrects locally in the Worker', async ({ page, context }) => {
  const apiRequests: string[] = [];
  context.on('request', request => { if (request.url().includes('/api/transform')) apiRequests.push(request.url()); });
  const workerResources = async () => (await Promise.all(page.workers().map(worker =>
    worker.evaluate(() => performance.getEntriesByType('resource').map(resource => resource.name))))).flat();
  await page.goto('/');
  const toggle = page.getByRole('checkbox', { name: /PunctCase/u });
  await expect(toggle).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill('qeyd edək ki bu məsələ hələ araşdırılır');
  await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toHaveText('Qeyd edək ki bu məsələ hələ araşdırılır.');
  const marker = weights.data.slice(512, 640);
  const before = await workerResources();

  await toggle.check();
  await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toHaveText('Qeyd edək ki, bu məsələ hələ araşdırılır.');
  const after = await workerResources(), root = resolve('.next/static/chunks');
  const weightChunks = scriptsUnder(root).filter(file => readFileSync(file, 'utf8').includes(marker))
    .map(file => relative(root, file).replaceAll('\\', '/'));
  expect(weightChunks.length).toBeGreaterThan(0);
  const loaded = (urls: string[]) => urls.some(url => weightChunks.some(chunk => new URL(url).pathname.endsWith('/' + chunk)));
  expect(loaded(before)).toBe(false);
  expect(loaded(after)).toBe(true);
  expect(after.filter(url => url.includes('/api/transform'))).toEqual([]);
  expect(apiRequests).toEqual([]);
  const latest = await page.evaluate(() => JSON.parse(localStorage.getItem('slothai-transform-log-v1') ?? '[]').at(-1));
  expect(latest.usePunctCase).toBe(true);
  expect(latest.output).toBe('Qeyd edək ki, bu məsələ hələ araşdırılır.');

  await page.getByRole('button', { name: 'Mail Düzəldici', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await page.getByRole('button', { name: 'Mətn Düzəldici', exact: true }).click();
  await expect(toggle).toBeChecked();
});

test('PunctCase preserves explicit punctuation and Markdown relative to baseline', async ({ page }) => {
  await page.goto('/');
  for (const source of ['Mən bilirəm ki, sən sabah gələcəksən.', '**qeyd edək ki bu məsələ hələ araşdırılır**',
    '> qeyd edək ki bu məsələ hələ araşdırılır', '[qeyd edək ki bu məsələ hələ araşdırılır](/guide)']) {
    await page.getByRole('checkbox', { name: /PunctCase/u }).uncheck();
    await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill(source);
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await expect(page.locator('.workspace-output pre')).toBeVisible();
    const baseline = await page.locator('.workspace-output pre').textContent();
    await page.getByRole('checkbox', { name: /PunctCase/u }).check();
    await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
    await expect(page.locator('.workspace-output pre')).toHaveText(baseline!);
  }
});
