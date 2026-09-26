import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { documentHTML, documentText, transferMarks, type RichDocument } from '../lib/ui/rich-document';

const marked = (word: string, marks: RichDocument['blocks'][number]['children'][number]['marks']): RichDocument => ({
  blocks: [{ type: 'paragraph', children: [
    { text: 'men ', marks: [] }, { text: word, marks }, { text: ' ucun muraciet yazdim', marks: [] },
  ] }],
});

for (const marks of [
  ['italic'], ['bold'], ['underline'], ['quote'], ['code'],
  ['quote', 'italic'], ['bold', 'italic'],
] as const) {
  test(`corrected word keeps ${marks.join('+')} formatting`, () => {
    const source = marked('sened', [...marks]);
    const corrected = correctText(documentText(source)).text;
    const output = transferMarks(source, corrected);
    assert.ok(output.blocks.flatMap(block => block.children)
      .some(child => child.text === 'sənəd' && marks.every(mark => child.marks.includes(mark))));
    assert.equal(documentText(transferMarks(output, correctText(documentText(output)).text)), corrected);
  });
}

test('ordered and bullet lists retain plain-text markers and semantic block types', () => {
  const source: RichDocument = { blocks: [
    { type: 'ordered', children: [{ text: 'senedi yoxla', marks: ['italic'] }] },
    { type: 'ordered', children: [{ text: 'sonra gonder', marks: [] }] },
    { type: 'bullet', children: [{ text: 'qeyd', marks: ['bold'] }] },
  ] };
  assert.equal(documentText(source), '1. senedi yoxla\n2. sonra gonder\n- qeyd');
  const output = transferMarks(source, '1. Sənədi yoxla.\n2. Sonra göndər.\n- Qeyd.');
  assert.deepEqual(output.blocks.map(block => block.type), ['ordered', 'ordered', 'bullet']);
  assert.equal(output.blocks[0].children.find(child => child.text === 'Sənədi')?.marks[0], 'italic');
});

test('a generated email subject does not steal a marked word from the body', () => {
  const source: RichDocument = { blocks: [{ type: 'paragraph', children: [
    { text: 'sened novu', marks: ['italic'] },
  ] }] };
  const output = transferMarks(source, 'Mövzu: Sorğu\nSənəd növü.');
  assert.equal(output.blocks[0].children.some(child => child.marks.length), false);
  assert.ok(output.blocks[1].children.some(child => child.text === 'Sənəd' && child.marks.includes('italic')));
});

test('clipboard HTML only contains semantic tags and escapes untrusted text', () => {
  const rich: RichDocument = { blocks: [
    { type: 'paragraph', children: [{ text: '“<img src=x onerror=alert(1)>” & sənəd', marks: ['quote', 'italic'] }] },
    { type: 'ordered', children: [{ text: 'API "x"', marks: ['code'] }] },
  ] };
  const html = documentHTML(rich);
  assert.equal(html, '<p><em><q>“&lt;img src=x onerror=alert(1)&gt;” &amp; sənəd</q></em></p><ol><li><code>API &quot;x&quot;</code></li></ol>');
  assert.equal(html.includes('<img'), false);
  assert.equal(documentText(rich), '“<img src=x onerror=alert(1)>” & sənəd\n1. API "x"');
});
