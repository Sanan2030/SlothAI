/** Only these semantic marks may cross the editor's DOM and clipboard boundary. */
export type RichMark = 'bold' | 'italic' | 'underline' | 'quote' | 'code';
export interface RichInline { text: string; marks: RichMark[] }
export interface RichBlock { type: 'paragraph' | 'bullet' | 'ordered'; children: RichInline[] }
export interface RichDocument { blocks: RichBlock[] }

const tags: Record<RichMark, string> = {
  bold: 'strong', italic: 'em', underline: 'u', quote: 'q', code: 'code',
};
const markByTag: Record<string, RichMark> = {
  STRONG: 'bold', B: 'bold', EM: 'italic', I: 'italic', U: 'underline',
  Q: 'quote', CODE: 'code',
};
const removed = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'TEMPLATE']);

export function plainDocument(text: string): RichDocument {
  return { blocks: text.replace(/\r\n?/gu, '\n').split('\n').map(line => ({
    type: 'paragraph', children: [{ text: line, marks: [] }],
  })) };
}

export function documentText(document: RichDocument): string {
  let ordered = 0;
  return document.blocks.map(block => {
    if (block.type !== 'ordered') ordered = 0;
    const prefix = block.type === 'bullet' ? '- ' : block.type === 'ordered' ? `${++ordered}. ` : '';
    return prefix + block.children.map(child => child.text).join('');
  }).join('\n');
}

function merge(children: RichInline[]): RichInline[] {
  const result: RichInline[] = [];
  for (const child of children) {
    if (!child.text) continue;
    const marks = [...new Set(child.marks)].sort();
    const previous = result.at(-1);
    if (previous && previous.marks.join(',') === marks.join(',')) previous.text += child.text;
    else result.push({ text: child.text, marks });
  }
  return result;
}

/** Parse untrusted pasted HTML. Unknown containers lose attributes; active content is discarded. */
export function parseRichHTML(html: string): RichDocument {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const blocks: RichBlock[] = [];
  const collect = (node: Node, marks: RichMark[], target: RichInline[]) => {
    if (node.nodeType === Node.TEXT_NODE) { target.push({ text: node.textContent ?? '', marks }); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (removed.has(element.tagName)) return;
    if (element.tagName === 'BR') { target.push({ text: '\n', marks }); return; }
    const mark = markByTag[element.tagName];
    const next = mark && !marks.includes(mark) ? [...marks, mark] : marks;
    for (const child of element.childNodes) collect(child, next, target);
  };
  const add = (node: Node, type: RichBlock['type']) => {
    const children: RichInline[] = [];
    collect(node, [], children);
    const lines: RichInline[][] = [[]];
    for (const inline of children) {
      const parts = inline.text.split('\n');
      parts.forEach((part, index) => {
        if (index) lines.push([]);
        lines.at(-1)!.push({ text: part, marks: inline.marks });
      });
    }
    for (const line of lines) blocks.push({ type, children: merge(line) });
  };
  const walk = (parent: ParentNode, list?: 'bullet' | 'ordered') => {
    for (const child of parent.childNodes) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        if (child.textContent?.trim()) add(child, list ?? 'paragraph');
        continue;
      }
      const element = child as Element;
      if (removed.has(element.tagName)) continue;
      if (element.tagName === 'UL' || element.tagName === 'OL') {
        walk(element, element.tagName === 'UL' ? 'bullet' : 'ordered');
      } else if (element.tagName === 'LI' || ['P', 'DIV', 'BLOCKQUOTE'].includes(element.tagName)) {
        add(element, list ?? 'paragraph');
      } else if (!element.children.length || Object.hasOwn(markByTag, element.tagName)) {
        add(element, list ?? 'paragraph');
      } else walk(element, list);
    }
  };
  walk(dom.body);
  return { blocks: blocks.length ? blocks : [{ type: 'paragraph', children: [] }] };
}

export function renderRichDocument(document: RichDocument, owner: Document): DocumentFragment {
  const result = owner.createDocumentFragment();
  let list: HTMLElement | undefined;
  let listType: RichBlock['type'] = 'paragraph';
  for (const block of document.blocks) {
    if (block.type !== listType) list = undefined;
    listType = block.type;
    if (block.type !== 'paragraph' && !list) {
      list = owner.createElement(block.type === 'bullet' ? 'ul' : 'ol');
      result.append(list);
    }
    const container = owner.createElement(block.type === 'paragraph' ? 'p' : 'li');
    if (!block.children.length) container.append(owner.createElement('br'));
    for (const child of block.children) {
      let node: Node = owner.createTextNode(child.text);
      for (const mark of [...new Set(child.marks)].sort().reverse()) {
        const wrapped = owner.createElement(tags[mark]);
        wrapped.append(node);
        node = wrapped;
      }
      container.append(node);
    }
    if (block.type === 'paragraph') result.append(container);
    else list!.append(container);
  }
  return result;
}

export function documentHTML(rich: RichDocument): string {
  const escape = (value: string) => value.replace(/[&<>"']/gu, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
  let html = '';
  let list: 'bullet' | 'ordered' | undefined;
  for (const block of rich.blocks) {
    if (list && block.type !== list) {
      html += list === 'bullet' ? '</ul>' : '</ol>';
      list = undefined;
    }
    if (block.type !== 'paragraph' && !list) {
      list = block.type;
      html += list === 'bullet' ? '<ul>' : '<ol>';
    }
    const tag = block.type === 'paragraph' ? 'p' : 'li';
    html += `<${tag}>`;
    if (!block.children.length) html += '<br>';
    for (const child of block.children) {
      const marks = [...new Set(child.marks)].sort();
      for (const mark of marks) html += `<${tags[mark]}>`;
      html += escape(child.text);
      for (const mark of marks.reverse()) html += `</${tags[mark]}>`;
    }
    html += `</${tag}>`;
  }
  if (list) html += list === 'bullet' ? '</ul>' : '</ol>';
  return html;
}

/** Transfer marks by ordered word, not character offset, so restored diacritics survive. */
export function transferMarks(before: RichDocument, corrected: string): RichDocument {
  const source = before.blocks.flatMap((block, index) => [
    ...block.children.flatMap(inline => (inline.text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? [])
      .map(token => ({ token, marks: inline.marks }))),
    ...(index + 1 < before.blocks.length ? [{ token: '\n', marks: [] }] : []),
  ]);
  const sourceWords = source.filter(item => /^[\p{L}\p{N}]+$/u.test(item.token));
  const output = plainDocument(corrected);
  let index = 0;
  const fold = (value: string) => value.toLocaleLowerCase('az-AZ').replace(/[əçıöüşğ]/gu,
    letter => ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' })[letter]!);
  for (const block of output.blocks) {
    const parts: RichInline[] = [];
    let line = block.children.map(child => child.text).join('');
    const marker = line.match(/^\s*(?:([-*])|(\d+)[.)])\s+/u);
    if (marker) {
      block.type = marker[2] ? 'ordered' : 'bullet';
      line = line.slice(marker[0].length);
    } else if (output.blocks.length === before.blocks.length) {
      block.type = before.blocks[output.blocks.indexOf(block)].type;
    }
    for (const token of line.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? []) {
      const word = /^[\p{L}\p{N}]+$/u.test(token);
      let marks: RichMark[] = [];
      if (word && index < sourceWords.length) {
        const candidate = fold(token);
        const current = fold(sourceWords[index].token);
        const match = sourceWords.findIndex((item, at) => at >= index && at < index + 8 && fold(item.token) === candidate);
        if (match >= 0) {
          marks = sourceWords[match].marks;
          index = match + 1;
        } else if (candidate.slice(0, 3) === current.slice(0, 3)) {
          marks = sourceWords[index++].marks;
        }
      }
      parts.push({ text: token, marks });
    }
    block.children = merge(parts);
  }
  return output;
}
