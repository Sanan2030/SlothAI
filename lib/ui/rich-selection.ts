import { parseRichHTML, type RichDocument, type RichInline } from './rich-document';

export interface RichPosition { block: number; offset: number }
export interface RichSelection { document: RichDocument; start: RichPosition; end: RichPosition }
const length = (children: RichInline[]) => children.reduce((sum, child) => sum + child.text.length, 0);

/** Resolve browser ranges through the same parser as pasted/native content.
 * Markers exist only in a detached clone; they never enter the visible editor. */
export function readRichSelection(root: HTMLElement, range: Range): RichSelection {
  const copy = root.cloneNode(true) as HTMLElement;
  const locate = (node: Node): Node => {
    const path: number[] = [];
    for (let at = node; at !== root; at = at.parentNode!) path.unshift(Array.from(at.parentNode!.childNodes).indexOf(at as ChildNode));
    return path.reduce<Node>((at, index) => at.childNodes[index], copy);
  };
  const boundary = (node: Node, offset: number, end: boolean): [Node, number] => {
    if (node === root && root.childNodes.length) {
      const child = root.childNodes[end ? Math.max(0, offset - 1) : Math.min(offset, root.childNodes.length - 1)];
      let target = locate(child);
      while (target.nodeType === Node.ELEMENT_NODE && !['P', 'LI'].includes((target as Element).tagName) && target.childNodes.length) {
        target = end ? target.lastChild! : target.firstChild!;
      }
      return [target, end ? target.nodeType === Node.TEXT_NODE ? target.textContent?.length ?? 0 : target.childNodes.length : 0];
    }
    return [locate(node), offset];
  };
  const selected = root.ownerDocument.createRange();
  selected.setStart(...boundary(range.startContainer, range.startOffset, false));
  selected.setEnd(...boundary(range.endContainer, range.endOffset, true));
  let startMarker = '\uE002'; while (root.textContent?.includes(startMarker)) startMarker += '\uE002';
  let endMarker = '\uE003'; while (root.textContent?.includes(endMarker)) endMarker += '\uE003';
  const endRange = selected.cloneRange(); endRange.collapse(false); endRange.insertNode(root.ownerDocument.createTextNode(endMarker));
  const startRange = selected.cloneRange(); startRange.collapse(true); startRange.insertNode(root.ownerDocument.createTextNode(startMarker));
  const document = parseRichHTML(copy.innerHTML);
  const positions: RichPosition[] = [];
  for (const marker of [startMarker, endMarker]) {
    for (const [block, row] of document.blocks.entries()) {
      const text = row.children.map(child => child.text).join('');
      const offset = text.indexOf(marker);
      if (offset < 0) continue;
      positions.push({ block, offset });
      row.children = row.children.map(child => ({ ...child, text: child.text.replace(marker, '') }));
      break;
    }
  }
  return { document, start: positions[0], end: positions[1] };
}

export function restoreRichSelection(root: HTMLElement, start: RichPosition, end = start): void {
  const blocks = root.querySelectorAll('p,li');
  const boundary = (position: RichPosition): [Node, number] => {
    const block = blocks[Math.min(position.block, blocks.length - 1)] ?? root;
    const walker = root.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let remaining = position.offset, node: Node | null;
    while ((node = walker.nextNode())) {
      if (remaining <= (node.textContent?.length ?? 0)) return [node, remaining];
      remaining -= node.textContent?.length ?? 0;
    }
    return [block, block.childNodes.length];
  };
  const range = root.ownerDocument.createRange();
  range.setStart(...boundary(start)); range.setEnd(...boundary(end));
  root.focus();
  const selection = root.ownerDocument.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
}

function slice(children: RichInline[], from: number, to = Infinity): RichInline[] {
  let at = 0;
  return children.flatMap(child => {
    const begin = at; at += child.text.length;
    const text = child.text.slice(Math.max(0, from - begin), Math.max(0, to - begin));
    return text ? [{ ...child, text }] : [];
  });
}

export function replaceRichSelection(selected: RichSelection, inserted: RichDocument): { document: RichDocument; caret: RichPosition } {
  const { document, start, end } = selected;
  const prefix = slice(document.blocks[start.block].children, 0, start.offset);
  const suffix = slice(document.blocks[end.block].children, end.offset);
  const blocks = inserted.blocks.map(block => ({ ...block, children: block.children.map(child => ({ ...child })) }));
  if (!blocks.length) blocks.push({ type: 'paragraph', children: [] });
  if (blocks[0].type === 'paragraph') blocks[0].type = document.blocks[start.block].type;
  blocks[0].children.unshift(...prefix);
  const caret = { block: start.block + blocks.length - 1, offset: length(blocks.at(-1)!.children) };
  blocks.at(-1)!.children.push(...suffix);
  return { document: { blocks: [...document.blocks.slice(0, start.block), ...blocks, ...document.blocks.slice(end.block + 1)] }, caret };
}
