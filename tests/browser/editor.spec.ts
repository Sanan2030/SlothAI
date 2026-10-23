import { expect, test, type Page, type Locator } from '@playwright/test';

async function openEditor(page: Page, input = 'sened hazirdir\ncavab gozleyirem\ntesekkur edirem') {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Xam mətn', exact: true }).fill(input);
  await page.getByLabel('Mövcud abzasları saxla').check();
  await page.getByRole('button', { name: 'Düzəlt', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toBeVisible();
  await page.getByRole('button', { name: 'Nəticəni redaktə et', exact: true }).click();
  return page.getByRole('textbox', { name: 'Nəticəni redaktə et', exact: true });
}

async function selectAll(editor: Locator) {
  await editor.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
}

async function paste(editor: Locator, html: string) {
  await editor.evaluate((element, content) => {
    const data = new DataTransfer(); data.setData('text/html', content);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, html);
}

test('selected paragraphs become visible numbered lists, switch type and toggle off', async ({ page }) => {
  const editor = await openEditor(page);
  await selectAll(editor);
  await page.getByRole('button', { name: 'Nömrələnmiş siyahı', exact: true }).click();
  await expect(editor.locator('ol > li')).toHaveCount(3);
  await expect(editor.locator('ol')).toHaveCSS('list-style-type', 'decimal');
  await expect(editor.locator('ol ol, li p, li li')).toHaveCount(0);
  await page.getByRole('button', { name: 'Markerlənmiş siyahı', exact: true }).click();
  await expect(editor.locator('ul > li')).toHaveCount(3);
  await expect(editor.locator('ul')).toHaveCSS('list-style-type', 'disc');
  await page.getByRole('button', { name: 'Markerlənmiş siyahı', exact: true }).click();
  await expect(editor.locator('p')).toHaveCount(3);
  await expect(editor.locator('ol,ul')).toHaveCount(0);
});

test('nested pasted blocks, empty paragraphs, formatting and lists survive', async ({ page }) => {
  const editor = await openEditor(page);
  await selectAll(editor);
  await paste(editor, '<div><p><strong>Birinci abzas.</strong></p><p><br></p><div><p>İkinci abzas.</p></div><ol><li>Bir</li><li>İki</li></ol><script>bad()</script></div>');
  await expect(editor.locator('p')).toHaveCount(3);
  await expect(editor.locator('strong')).toHaveText('Birinci abzas.');
  await expect(editor.locator('ol > li')).toHaveCount(2);
  await expect(editor.locator('script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dəyişiklikləri göstər', exact: true }).click();
  await expect(page.locator('.workspace-output pre')).toHaveText('Birinci abzas.\n\nİkinci abzas.\n1. Bir\n2. İki');
});

test('empty output stays editable and can be numbered at the caret', async ({ page }) => {
  const editor = await openEditor(page);
  await editor.focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Backspace');
  await expect(editor).toBeVisible();
  await page.keyboard.type('Yeni qeyd');
  await page.getByRole('button', { name: 'Nömrələnmiş siyahı', exact: true }).click();
  await expect(editor.locator('ol > li')).toHaveText('Yeni qeyd');
});

test('partial selection only changes touched paragraphs and preserves bold text', async ({ page }) => {
  const editor = await openEditor(page);
  await selectAll(editor);
  await paste(editor, '<div><p>Əvvəl</p><p><b>Birinci</b> qeyd</p><p>İkinci qeyd</p><p>Sonra</p></div>');
  await editor.evaluate(element => {
    const blocks = element.querySelectorAll('p'), range = document.createRange();
    range.selectNodeContents(blocks[1]); range.setEndBefore(blocks[3]);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.getByRole('button', { name: 'Nömrələnmiş siyahı', exact: true }).click();
  await expect(editor.locator('ol > li')).toHaveCount(2);
  await expect(editor.locator(':scope > p')).toHaveText(['Əvvəl', 'Sonra']);
  await expect(editor.locator('ol strong')).toHaveText('Birinci');
});

test('engine-generated list markers do not get duplicated in editable lists', async ({ page }) => {
  const editor = await openEditor(page, '1) senedi yoxla\n2) cavabi gonder');
  await expect(editor.locator('ol > li')).toHaveCount(2);
  await expect(editor.locator('ol > li').first()).not.toContainText('1)');
  await selectAll(editor);
  await page.getByRole('button', { name: 'Nömrələnmiş siyahı', exact: true }).click();
  await expect(editor.locator('ol')).toHaveCount(0);
  await expect(editor.locator('p')).toHaveCount(2);
});

test('line breaks inside one browser paragraph become separate list items', async ({ page }) => {
  const editor = await openEditor(page);
  await selectAll(editor);
  await paste(editor, '<p>Birinci<br>İkinci<br>Üçüncü</p>');
  await selectAll(editor);
  await page.getByRole('button', { name: 'Nömrələnmiş siyahı', exact: true }).click();
  await expect(editor.locator('ol > li')).toHaveText(['Birinci', 'İkinci', 'Üçüncü']);
  await editor.locator('li').last().click();
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('Dorduncu');
  await expect(editor.locator('ol > li')).toHaveCount(4);
});

test('plain-text numbered paste becomes a semantic list without repeated numbers', async ({ page }) => {
  const editor = await openEditor(page);
  await selectAll(editor);
  await editor.evaluate(element => {
    const data = new DataTransfer(); data.setData('text/plain', '1. Birinci\n2. İkinci');
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(editor.locator('ol > li')).toHaveText(['Birinci', 'İkinci']);
  await selectAll(editor);
  await page.getByRole('button', { name: 'Markerlənmiş siyahı', exact: true }).click();
  await expect(editor.locator('ul > li')).toHaveText(['Birinci', 'İkinci']);
});
