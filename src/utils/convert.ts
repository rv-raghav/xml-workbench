import { formatJson } from './jsonFormatter';
import { escapeAttr, escapeText, formatXml, parseXmlDocument } from './xmlFormatter';
import { indentString } from './indent';
import type { FormatOptions } from '../types';

export function xmlStringToJson(
  xml: string,
  options: FormatOptions,
): string {
  const parsed = parseXmlDocument(xml);
  if (parsed.error) {
    throw new Error(parsed.error.message);
  }
  const root = parsed.doc.documentElement;
  if (!root) throw new Error('No root element');
  const value = elementToJson(root);
  const space = options.indent === 'tab' ? '\t' : options.indent;
  return `${JSON.stringify({ [root.tagName]: value }, null, space)}\n`;
}

export function jsonStringToXml(
  json: string,
  options: FormatOptions,
): string {
  const value: unknown = JSON.parse(json);
  const indent = indentString(options.indent);
  const xml = jsonToXml(value, indent, 0);
  const result = formatXml(xml, options);
  if (result.error) return xml;
  return result.formatted;
}

export function convertXmlTabToJson(
  xml: string,
  options: FormatOptions,
) {
  const converted = xmlStringToJson(
    formatXml(xml, options).formatted || xml,
    options,
  );
  return formatJson(converted, options);
}

export function convertJsonTabToXml(
  json: string,
  options: FormatOptions,
) {
  const xml = jsonStringToXml(json, options);
  return formatXml(xml, options);
}

function elementToJson(el: Element): unknown {
  const obj: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) {
    obj[`@${attr.name}`] = attr.value;
  }

  const elementChildren = Array.from(el.children);
  const text = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE)
    .map((n) => (n.textContent ?? '').trim())
    .filter(Boolean)
    .join('');

  if (elementChildren.length === 0) {
    if (Object.keys(obj).length === 0) return text;
    if (text) obj['#text'] = text;
    return obj;
  }

  const grouped = new Map<string, unknown[]>();
  for (const child of elementChildren) {
    const list = grouped.get(child.tagName) ?? [];
    list.push(elementToJson(child));
    grouped.set(child.tagName, list);
  }
  for (const [name, list] of grouped) {
    obj[name] = list.length === 1 ? list[0] : list;
  }
  if (text) obj['#text'] = text;
  return obj;
}

function jsonToXml(value: unknown, indent: string, level: number): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => wrap('item', item, indent, level))
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && !keys[0].startsWith('@') && keys[0] !== '#text') {
      return wrap(keys[0], obj[keys[0]], indent, level);
    }
    return wrap('root', obj, indent, level);
  }
  return wrap('root', value, indent, level);
}

function wrap(
  name: string,
  value: unknown,
  indent: string,
  level: number,
): string {
  const pad = indent.repeat(level);
  if (Array.isArray(value)) {
    return value.map((v) => wrap(name, v, indent, level)).join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const attrs: string[] = [];
    const children: string[] = [];
    let text = '';
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('@')) {
        attrs.push(` ${k.slice(1)}="${escapeAttr(String(v))}"`);
      } else if (k === '#text') {
        text = escapeText(String(v));
      } else {
        children.push(wrap(k, v, indent, level + 1));
      }
    }
    if (children.length === 0) {
      return `${pad}<${name}${attrs.join('')}>${text}</${name}>`;
    }
    return `${pad}<${name}${attrs.join('')}>\n${children.join('\n')}${
      text ? `\n${indent.repeat(level + 1)}${text}` : ''
    }\n${pad}</${name}>`;
  }
  if (value === null || value === undefined) {
    return `${pad}<${name}/>`;
  }
  return `${pad}<${name}>${escapeText(String(value))}</${name}>`;
}
