import type { AppTreeNode } from '../types';
import { siblingIndexMap, toXPath, type PathSegment } from './xpath';

const TOKEN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?]]>|<\?[\s\S]*?\?>|<\/?[^>]+>|[^<]+/g;

export function lenientPretty(xml: string, indent: string): string {
  const tokens = xml.match(TOKEN_RE) ?? [xml];
  let depth = 0;
  const lines: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const raw = tokens[i];
    const token = raw.trim();
    if (!token) continue;

    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      const prev = tokens[i - 1]?.trim() ?? '';
      const isText = prev && !prev.startsWith('<');
      if (isText && lines.length > 0) {
        lines[lines.length - 1] += token;
      } else {
        lines.push(indent.repeat(depth) + token);
      }
    } else if (
      token.startsWith('<?') ||
      token.startsWith('<!--') ||
      token.startsWith('<![CDATA[') ||
      token.startsWith('<!')
    ) {
      lines.push(indent.repeat(depth) + token);
    } else if (token.startsWith('<') && token.endsWith('/>')) {
      lines.push(indent.repeat(depth) + token);
    } else if (token.startsWith('<')) {
      const next = tokens[i + 1]?.trim() ?? '';
      const nextClose = tokens[i + 2]?.trim() ?? '';
      if (next && !next.startsWith('<') && nextClose.startsWith('</')) {
        lines.push(indent.repeat(depth) + token + next + nextClose);
        i += 2;
      } else {
        lines.push(indent.repeat(depth) + token);
        depth += 1;
      }
    } else {
      lines.push(indent.repeat(depth) + token);
    }
  }

  return lines.join('\n');
}

export function lenientMinify(xml: string): string {
  return xml.replace(/>\s+</g, '><').trim();
}

interface StackItem {
  node: AppTreeNode;
  path: PathSegment[];
}

export function buildLenientTree(xml: string): AppTreeNode | null {
  const tokens = xml.match(TOKEN_RE) ?? [];
  const root: AppTreeNode = {
    id: 'root',
    kind: 'element',
    label: '#document',
    attributes: [],
    children: [],
    start: 0,
    end: xml.length,
    path: '/',
    childCount: 0,
  };
  const stack: StackItem[] = [{ node: root, path: [] }];
  let offset = 0;
  let seq = 0;

  const current = () => stack[stack.length - 1];

  for (const raw of tokens) {
    const start = xml.indexOf(raw, offset);
    const end = start + raw.length;
    offset = end;
    const token = raw.trim();
    if (!token) continue;

    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (token.startsWith('<!--')) {
      const parent = current();
      parent.node.children.push({
        id: `c${seq++}`,
        kind: 'comment',
        label: '#comment',
        preview: token.replace(/^<!--/, '').replace(/-->$/, '').trim(),
        attributes: [],
        children: [],
        start,
        end,
        path: toXPath([...parent.path, { name: 'comment()', kind: 'comment' }]),
        childCount: 0,
      });
      continue;
    }

    if (token.startsWith('<![CDATA[')) {
      const parent = current();
      parent.node.children.push({
        id: `d${seq++}`,
        kind: 'cdata',
        label: '#cdata',
        preview: token.replace(/^<!\[CDATA\[/, '').replace(/]]$/, ''),
        attributes: [],
        children: [],
        start,
        end,
        path: toXPath([...parent.path, { name: 'text()', kind: 'cdata' }]),
        childCount: 0,
      });
      continue;
    }

    if (token.startsWith('<?')) {
      const parent = current();
      const name = token.slice(2).split(/\s+/)[0]?.replace(/\?>$/, '') ?? 'pi';
      parent.node.children.push({
        id: `p${seq++}`,
        kind: 'pi',
        label: name,
        preview: token,
        attributes: [],
        children: [],
        start,
        end,
        path: toXPath([...parent.path, { name, kind: 'pi' }]),
        childCount: 0,
      });
      continue;
    }

    if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>');
      const inner = token.replace(/^<\s*/, '').replace(/\/?>$/, '');
      const name = inner.split(/\s+/)[0] ?? 'unknown';
      const attrs = parseAttrs(inner.slice(name.length));
      const parent = current();
      const elementNames = parent.node.children
        .filter((c) => c.kind === 'element')
        .map((c) => c.label);
      const upcoming = [...elementNames, name];
      const indexes = siblingIndexMap(upcoming);
      const sib = indexes[indexes.length - 1];
      const seg: PathSegment = { name, index: sib.index };
      const node: AppTreeNode = {
        id: `e${seq++}`,
        kind: 'element',
        label: name,
        attributes: attrs,
        children: [],
        start,
        end,
        path: toXPath([...parent.path, seg]),
        childCount: 0,
        siblingIndex: sib.index,
        siblingCount: sib.count,
      };
      parent.node.children.push(node);
      if (!selfClosing) {
        stack.push({ node, path: [...parent.path, seg] });
      }
      continue;
    }

    const parent = current();
    parent.node.children.push({
      id: `t${seq++}`,
      kind: 'text',
      label: '#text',
      preview: token,
      attributes: [],
      children: [],
      start,
      end,
      path: toXPath([...parent.path, { name: 'text()', kind: 'text' }]),
      childCount: 0,
    });
  }

  const assignCounts = (n: AppTreeNode) => {
    n.childCount = n.children.filter((c) => c.kind === 'element').length;
    n.children.forEach(assignCounts);
  };
  assignCounts(root);
  return root.children.length === 1 ? root.children[0] : root;
}

function parseAttrs(source: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push({ name: m[1], value: m[3] ?? m[4] ?? '' });
  }
  return out;
}
