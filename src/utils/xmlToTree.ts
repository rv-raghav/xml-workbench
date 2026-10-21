import type { AppTreeNode } from '../types';
import { siblingIndexMap, toXPath, type PathSegment } from './xpath';

export function annotateXmlTree(
  node: AppTreeNode,
  parent: PathSegment[] = [],
): AppTreeNode {
  const elementKids = node.children.filter((c) => c.kind === 'element');
  const names = elementKids.map((c) => c.label);
  const indexes = siblingIndexMap(names);

  let elementCursor = 0;
  let commentCursor = 0;
  let piCursor = 0;

  const selfSeg: PathSegment =
    node.kind === 'element'
      ? {
          name: node.label,
          index: node.siblingIndex,
        }
      : {
          name: node.label,
          kind:
            node.kind === 'comment' ||
            node.kind === 'cdata' ||
            node.kind === 'pi' ||
            node.kind === 'text'
              ? node.kind
              : 'element',
          index: node.siblingIndex,
        };

  const selfPath =
    node.label === '#document' ? parent : [...parent, selfSeg];

  const children = node.children.map((child) => {
    let siblingIndex = child.siblingIndex;
    let siblingCount = child.siblingCount;
    if (child.kind === 'element') {
      const sib = indexes[elementCursor];
      elementCursor += 1;
      siblingIndex = sib.index;
      siblingCount = sib.count;
    } else if (child.kind === 'comment') {
      commentCursor += 1;
      siblingIndex = commentCursor;
    } else if (child.kind === 'pi') {
      piCursor += 1;
      siblingIndex = piCursor;
    }
    const annotated = annotateXmlTree(
      {
        ...child,
        siblingIndex,
        siblingCount,
      },
      selfPath,
    );
    return annotated;
  });

  return {
    ...node,
    path:
      node.label === '#document'
        ? '/'
        : toXPath(selfPath),
    childCount: elementKids.length,
    children,
    siblingIndex: node.siblingIndex,
    siblingCount: node.siblingCount,
  };
}

export function findNodeByOffset(
  node: AppTreeNode | null,
  offset: number,
): AppTreeNode | null {
  if (!node) return null;
  if (offset < node.start || offset > node.end) return null;
  for (let i = node.children.length - 1; i >= 0; i -= 1) {
    const child = findNodeByOffset(node.children[i], offset);
    if (child) return child;
  }
  return node;
}

export function findNodeById(
  node: AppTreeNode | null,
  id: string,
): AppTreeNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function collectMatches(
  node: AppTreeNode | null,
  query: string,
): AppTreeNode[] {
  if (!node || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const out: AppTreeNode[] = [];
  walk(node, (n) => {
    if (nodeMatches(n, q)) out.push(n);
  });
  return out;
}

export function nodeMatches(node: AppTreeNode, q: string): boolean {
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.preview?.toLowerCase().includes(q)) return true;
  if (node.path.toLowerCase().includes(q)) return true;
  return node.attributes.some(
    (a) =>
      a.name.toLowerCase().includes(q) || a.value.toLowerCase().includes(q),
  );
}

export function walk(
  node: AppTreeNode,
  visit: (node: AppTreeNode) => void,
): void {
  visit(node);
  node.children.forEach((c) => walk(c, visit));
}

export function ancestorIds(
  root: AppTreeNode | null,
  id: string,
): string[] {
  if (!root) return [];
  const chain: string[] = [];
  const dfs = (n: AppTreeNode): boolean => {
    if (n.id === id) {
      chain.push(n.id);
      return true;
    }
    for (const c of n.children) {
      if (dfs(c)) {
        chain.unshift(n.id);
        return true;
      }
    }
    return false;
  };
  dfs(root);
  return chain;
}

export function idsToLevel(node: AppTreeNode, level: number, depth = 1): string[] {
  if (depth > level) return [];
  const ids = [node.id];
  if (depth === level) return ids;
  for (const child of node.children) {
    ids.push(...idsToLevel(child, level, depth + 1));
  }
  return ids;
}

export function allIds(node: AppTreeNode): string[] {
  const ids = [node.id];
  for (const child of node.children) ids.push(...allIds(child));
  return ids;
}

export function flattenVisible(
  node: AppTreeNode,
  expanded: Set<string>,
  depth = 1,
): Array<AppTreeNode & { depth: number }> {
  const row: AppTreeNode & { depth: number } = { ...node, depth };
  const rows: Array<AppTreeNode & { depth: number }> = [row];
  if (node.children.length > 0 && expanded.has(node.id)) {
    for (const child of node.children) {
      rows.push(...flattenVisible(child, expanded, depth + 1));
    }
  }
  return rows;
}
