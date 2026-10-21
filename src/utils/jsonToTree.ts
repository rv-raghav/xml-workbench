import type { AppTreeNode, TreeKind } from '../types';
import { jsonPath } from './xpath';

export function jsonToTree(
  value: unknown,
  formatted: string,
  name = 'root',
  path: Array<string | number> = [],
): AppTreeNode {
  const kind = jsonKind(value);
  const start = findValueStart(formatted, path, name);
  const serialized = JSON.stringify(value, null, 2);
  const end = Math.min(formatted.length, start + Math.max(serialized.length, 1));

  if (kind === 'array' && Array.isArray(value)) {
    const children = value.map((item, i) =>
      jsonToTree(item, formatted, String(i), [...path, i]),
    );
    return {
      id: pathKey(path, name),
      kind,
      label: name,
      preview: `Array(${value.length})`,
      attributes: [],
      children,
      start,
      end,
      path: jsonPath(path.length ? path : [name]),
      childCount: children.length,
    };
  }

  if (kind === 'object' && value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const children = keys.map((key) =>
      jsonToTree(obj[key], formatted, key, [...path, key]),
    );
    return {
      id: pathKey(path, name),
      kind,
      label: name,
      preview: `{${keys.length}}`,
      attributes: [],
      children,
      start,
      end,
      path: jsonPath(path.length ? path : [name]),
      childCount: children.length,
    };
  }

  const preview =
    kind === 'string' ? String(value) : JSON.stringify(value as never);
  return {
    id: pathKey(path, name),
    kind,
    label: name,
    preview,
    attributes: [],
    children: [],
    start,
    end,
    path: jsonPath(path.length ? path : [name]),
    childCount: 0,
  };
}

function jsonKind(value: unknown): TreeKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function pathKey(path: Array<string | number>, name: string): string {
  return path.length ? path.map(String).join('.') : name;
}

function findValueStart(
  formatted: string,
  path: Array<string | number>,
  name: string,
): number {
  if (path.length === 0) return 0;
  const last = path[path.length - 1];
  if (typeof last === 'string') {
    const needle = `"${last.replace(/"/g, '\\"')}":`;
    const idx = formatted.indexOf(needle);
    return idx === -1 ? 0 : idx;
  }
  const idx = formatted.indexOf(`"${name}"`);
  return idx === -1 ? 0 : idx;
}
