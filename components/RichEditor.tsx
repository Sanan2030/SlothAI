'use client';

import { useEffect, useRef } from 'react';
import {
  documentText, parseRichHTML, renderRichDocument, type RichDocument, type RichMark,
} from '@/lib/ui/rich-document';

const tagByMark: Record<RichMark, string> = {
  bold: 'strong', italic: 'em', underline: 'u', quote: 'q', code: 'code',
};
const controls: { action: RichMark | 'bullet' | 'ordered'; title: string; label: string }[] = [
  { action: 'bold', title: 'Qalın (Ctrl+B)', label: 'B' },
  { action: 'italic', title: 'Kursiv (Ctrl+I)', label: 'I' },
  { action: 'underline', title: 'Altıxətli (Ctrl+U)', label: 'U' },
  { action: 'quote', title: 'Sitat seçilmiş mətni dırnaqlara alır', label: '“”' },
  { action: 'code', title: 'Kod', label: '</>' },
  { action: 'bullet', title: 'Markerlənmiş siyahı', label: '•' },
  { action: 'ordered', title: 'Nömrələnmiş siyahı', label: '1.' },
];

function closestTag(node: Node, tag: string, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.tagName.toLowerCase() === tag) return current;
    current = current.parentNode;
  }
  return null;
}

function wrapRange(range: Range, tag: string): void {
  const fragment = range.extractContents();
  const wrapper = document.createElement(tag);
  wrapper.append(fragment);
  range.insertNode(wrapper);
  const selection = window.getSelection();
  const selected = document.createRange();
  selected.selectNodeContents(wrapper);
  selection?.removeAllRanges();
  selection?.addRange(selected);
}

export interface RichEditorProps {
  value: RichDocument;
  onChange: (document: RichDocument) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function RichEditor({ value, onChange, label, placeholder, disabled, maxLength }: RichEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const initialized = useRef(false);

  useEffect(() => {
    if (editor.current && (!initialized.current || last.current !== value)) {
      editor.current.replaceChildren(renderRichDocument(value, editor.current.ownerDocument));
      last.current = value;
      initialized.current = true;
    }
  }, [value]);

  function publish() {
    if (!editor.current) return;
    const next = parseRichHTML(editor.current.innerHTML);
    if (maxLength !== undefined && documentText(next).length > maxLength) {
      editor.current.replaceChildren(renderRichDocument(last.current, editor.current.ownerDocument));
      return;
    }
    last.current = next;
    onChange(next);
  }

  function act(action: RichMark | 'bullet' | 'ordered') {
    const root = editor.current;
    const selection = window.getSelection();
    if (!root || !selection?.rangeCount || selection.isCollapsed || disabled) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    if (action === 'bullet' || action === 'ordered') {
      const blocks = [...root.querySelectorAll('p,li')].filter(block => range.intersectsNode(block));
      if (!blocks.length) return;
      const list = document.createElement(action === 'bullet' ? 'ul' : 'ol');
      blocks[0].before(list);
      for (const block of blocks) {
        const item = document.createElement('li');
        item.append(...Array.from(block.childNodes));
        list.append(item);
        block.remove();
      }
    } else {
      const existing = closestTag(range.commonAncestorContainer, tagByMark[action], root);
      if (existing && existing.textContent === range.toString()) {
        existing.replaceWith(...Array.from(existing.childNodes));
      } else if (action === 'quote') {
        const selected = range.toString();
        const fragment = range.extractContents();
        const wrapper = document.createElement('q');
        if (!(selected.startsWith('“') && selected.endsWith('”'))) wrapper.append('“');
        wrapper.append(fragment);
        if (!(selected.startsWith('“') && selected.endsWith('”'))) wrapper.append('”');
        range.insertNode(wrapper);
        const selectedRange = document.createRange();
        selectedRange.selectNodeContents(wrapper);
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      } else wrapRange(range, tagByMark[action]);
    }
    publish();
  }

  function paste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const root = editor.current;
    const selection = window.getSelection();
    if (!root || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const html = event.clipboardData.getData('text/html');
    const source = html
      ? parseRichHTML(html)
      : { blocks: event.clipboardData.getData('text/plain').replace(/\r\n?/gu, '\n').split('\n')
        .map(line => ({ type: 'paragraph' as const, children: [{ text: line, marks: [] }] })) };
    const fragment = renderRichDocument(source, root.ownerDocument);
    range.deleteContents();
    range.insertNode(fragment);
    publish();
  }

  function drop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const root = editor.current;
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY)
      ?? window.getSelection()?.getRangeAt(0);
    if (!root || !range || !root.contains(range.commonAncestorContainer)) return;
    const raw = event.dataTransfer.getData('text/plain');
    range.deleteContents();
    range.insertNode(document.createTextNode(raw));
    publish();
  }

  return (
    <div className="workspace-rich-editor">
      <div className="workspace-rich-toolbar" role="toolbar" aria-label={`${label} formatı`}>
        {controls.map(control => (
          <button key={control.action} type="button" title={control.title}
            aria-label={control.title} disabled={disabled}
            onMouseDown={event => event.preventDefault()}
            onClick={() => act(control.action)}>{control.label}</button>
        ))}
      </div>
      <div ref={editor} contentEditable={!disabled} suppressContentEditableWarning
        role="textbox" aria-label={label} aria-multiline="true" spellCheck={false}
        data-placeholder={placeholder} data-empty={!documentText(value)}
        className="workspace-rich-surface"
        onInput={publish} onPaste={paste} onDrop={drop}
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
            event.preventDefault();
            act(({ b: 'bold', i: 'italic', u: 'underline' } as const)[event.key.toLowerCase() as 'b' | 'i' | 'u']);
          }
        }} />
    </div>
  );
}
