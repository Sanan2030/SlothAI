/** Lossless supported HTML scanner; no DOM execution, sanitization or network access. */
interface Element { name: string; open: string; close: string; children: Node[]; raw: string }
type Node = string | Element;
const blocks = new Set(['p', 'div', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article', 'table', 'thead', 'tbody', 'tr', 'ul', 'ol']);
const opaque = new Set(['pre', 'code', 'script', 'style']);
const voids = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track']);
export function editHTMLStructure(input: string, edit: (text: string) => string): string | undefined {
  if (!/<(?:[A-Za-z][\w-]*\b|!--)/u.test(input)) return undefined;
  let cursor = 0, invalid = false;
  function tagEnd(start: number): number {
    let quote = '';
    for (let at = start + 1; at < input.length; at++) {
      const char = input[at];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') return at + 1;
    }
    return -1;
  }
  function parse(parent = '', depth = 0): { nodes: Node[]; close: string } {
    if (depth > 64) { invalid = true; return { nodes: [], close: '' }; }
    const nodes: Node[] = [];
    while (cursor < input.length) {
      if (input[cursor] !== '<') {
        const next = input.indexOf('<', cursor); nodes.push(input.slice(cursor, next < 0 ? input.length : next)); cursor = next < 0 ? input.length : next; continue;
      }
      if (input.startsWith('<!--', cursor)) {
        const end = input.indexOf('-->', cursor + 4);
        if (end < 0) { invalid = true; break; }
        nodes.push({ name: 'comment', open: '', close: '', children: [], raw: input.slice(cursor, end + 3) }); cursor = end + 3; continue;
      }
      const end = tagEnd(cursor);
      if (end < 0) { invalid = true; break; }
      const start = cursor, tag = input.slice(start, end), match = tag.match(/^<\s*(\/?)\s*([A-Za-z][\w-]*)\b/u);
      if (!match) { nodes.push(tag); cursor = end; continue; }
      const name = match[2].toLowerCase(); cursor = end;
      if (match[1]) {
        if (parent !== name) { invalid = true; break; }
        return { nodes, close: tag };
      }
      if (voids.has(name) || /\/\s*>$/u.test(tag)) { nodes.push({ name, open: tag, close: '', children: [], raw: tag }); continue; }
      if (opaque.has(name)) {
        const lower = input.toLowerCase(), closingStart = lower.indexOf('</' + name, cursor);
        if (closingStart < 0) { invalid = true; break; }
        const closingEnd = tagEnd(closingStart); if (closingEnd < 0) { invalid = true; break; }
        cursor = closingEnd; nodes.push({ name, open: '', close: '', children: [], raw: input.slice(start, cursor) }); continue;
      }
      const child = parse(name, depth + 1);
      if (invalid || !child.close) { invalid = true; break; }
      nodes.push({ name, open: tag, close: child.close, children: child.nodes, raw: input.slice(start, cursor) });
    }
    if (parent) invalid = true;
    return { nodes, close: '' };
  }
  const tree = parse();
  if (invalid) return input; // Malformed/unsupported markup is preserved, never reconstructed speculatively.
  const serialize = (nodes: Node[]): string => nodes.map(node => typeof node === 'string' ? node : node.raw).join('');
  const hasBlock = (nodes: Node[]): boolean => nodes.some(node => typeof node !== 'string' && (blocks.has(node.name) || hasBlock(node.children)));
  function editInline(nodes: Node[]): string {
    const raw = serialize(nodes);
    let marker = 'HTML_OPAQUE'; while (raw.includes(marker)) marker += '_';
    const saved: string[] = [];
    const protect = (value: string) => '`' + marker + saved.push(value) + '`';
    const mask = (parts: Node[]): string => parts.map(node => {
      if (typeof node === 'string') return node;
      if (!node.children.length || opaque.has(node.name) || node.name === 'comment') return protect(node.raw);
      return protect(node.open) + mask(node.children) + protect(node.close);
    }).join('');
    const masked = mask(nodes);
    if (!masked.replace(new RegExp('`' + marker + '\\d+`', 'gu'), '').trim()) return raw;
    return edit(masked).replace(new RegExp('`' + marker + '(\\d+)`', 'gu'), (_, id: string) => saved[Number(id) - 1]);
  }
  if (!hasBlock(tree.nodes)) return editInline(tree.nodes);
  function render(nodes: Node[], root = false): string {
    return nodes.map(node => {
      if (typeof node === 'string') return root && node.trim() ? node.match(/^\s*/u)![0] + edit(node.trim()) + node.match(/\s*$/u)![0] : node;
      if (!node.children.length || opaque.has(node.name) || node.name === 'comment') return node.raw;
      if (!hasBlock(node.children)) {
        const raw = serialize(node.children); let content = editInline(node.children);
        if (['td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.name) && !/[.!?]$/u.test(raw.trim())) content = content.replace(/[.!?]+$/u, '');
        return node.open + content + node.close;
      }
      return node.open + render(node.children) + node.close;
    }).join('');
  }
  return render(tree.nodes, true);
}
