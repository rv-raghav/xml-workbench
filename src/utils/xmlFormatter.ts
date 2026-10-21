import type {
  AppTreeNode,
  FormatError,
  FormatOptions,
  FormatResult,
  TreeAttr,
} from '../types';
import {
  extractXmlPayload,
  looksLikeEscapedXml,
  unescapePayload,
} from './extractPayload';
import { indentString, indexFromLineColumn } from './indent';
import { buildLenientTree, lenientMinify, lenientPretty } from './xmlLenient';
import { annotateXmlTree } from './xmlToTree';
import { siblingIndexMap, toXPath, type PathSegment } from './xpath';

const PARSER_ERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';

export function formatXml(
  input: string,
  options: FormatOptions,
  alreadyUnescaped = false,
): FormatResult {
  const indent = indentString(options.indent);
  const extracted = extractXmlPayload(input);
  const canUnescape =
    !alreadyUnescaped && looksLikeEscapedXml(extracted.payload);
  const payload = extracted.payload;
  const notices: FormatResult['notices'] = [];
  if (extracted.trimmed) {
    notices.push({
      kind: 'trimmed',
      message: 'Trimmed non-XML text from input',
    });
  }
  if (canUnescape) {
    notices.push({
      kind: 'escaped',
      message: 'Input looks escaped. Use Unescape and format.',
    });
  }

  const declaration = payload.match(/^\s*<\?xml\b[\s\S]*?\?>/)?.[0]?.trim();
  const parsed = parseXmlDocument(payload);

  if (parsed.error) {
    notices.push({
      kind: 'lenient',
      message: 'Malformed XML — showing best-effort indentation',
    });
    const formatted = lenientPretty(payload, indent);
    return {
      formatted,
      minified: lenientMinify(payload),
      tree: (() => {
        const raw = buildLenientTree(formatted);
        return raw ? annotateXmlTree(raw) : null;
      })(),
      error: parsed.error,
      notices,
      canUnescape,
      usedLenient: true,
      extracted: extracted.trimmed,
    };
  }

  const writer = new Writer();
  if (declaration) {
    writer.write(declaration);
    writer.write('\n');
  }

  const roots: AppTreeNode[] = [];
  for (const child of Array.from(parsed.doc.childNodes)) {
    if (child.nodeType === Node.DOCUMENT_TYPE_NODE) {
      const dt = child as DocumentType;
      const pub = dt.publicId ? ` PUBLIC "${dt.publicId}"` : '';
      const sys = dt.systemId ? ` "${dt.systemId}"` : '';
      writer.write(`<!DOCTYPE ${dt.name}${pub}${sys}>`);
      writer.write('\n');
      continue;
    }
    if (isParserErrorNode(child)) continue;
    const node = serializeNode(
      child,
      0,
      indent,
      options.attributeWrapThreshold,
      writer,
      [],
    );
    if (node) roots.push(node);
  }

  const formatted = writer.toString().replace(/\n+$/, '') + '\n';
  const minified = minifyFromDocument(parsed.doc, declaration);

  const rawTree =
    roots.length === 1
      ? roots[0]
      : {
          id: 'root',
          kind: 'element' as const,
          label: '#document',
          attributes: [],
          children: roots,
          start: 0,
          end: formatted.length,
          path: '/',
          childCount: roots.filter((r) => r.kind === 'element').length,
        };
  const tree = annotateXmlTree(rawTree);

  return {
    formatted,
    minified,
    tree,
    error: null,
    notices,
    canUnescape,
    usedLenient: false,
    extracted: extracted.trimmed,
  };
}

export function unescapeAndFormatXml(
  input: string,
  options: FormatOptions,
): FormatResult {
  const extracted = extractXmlPayload(input);
  const unescaped = unescapePayload(extracted.payload);
  const result = formatXml(unescaped, options, true);
  if (extracted.trimmed && !result.notices.some((n) => n.kind === 'trimmed')) {
    result.notices.unshift({
      kind: 'trimmed',
      message: 'Trimmed non-XML text from input',
    });
  }
  return result;
}

export function parseXmlDocument(xml: string): {
  doc: Document;
  error: FormatError | null;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const errorNode = findParserError(doc);
  if (!errorNode) return { doc, error: null };

  const text = (errorNode.textContent || 'Malformed XML').replace(/\s+/g, ' ').trim();
  const lineMatch = text.match(/line\s+(\d+)/i);
  const colMatch = text.match(/column\s+(\d+)/i);
  const line = lineMatch ? Number(lineMatch[1]) : 1;
  const column = colMatch ? Number(colMatch[1]) : 1;
  return {
    doc,
    error: {
      message: simplifyParserMessage(text),
      line,
      column,
      index: indexFromLineColumn(xml, line, column),
    },
  };
}

function findParserError(doc: Document): Element | null {
  const byNs = doc.getElementsByTagNameNS(PARSER_ERROR_NS, 'parsererror')[0];
  if (byNs) return byNs;
  const byName = doc.getElementsByTagName('parsererror')[0];
  return byName ?? null;
}

function isParserErrorNode(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    ((node as Element).localName === 'parsererror' ||
      (node as Element).tagName.toLowerCase().includes('parsererror'))
  );
}

function simplifyParserMessage(text: string): string {
  const errorOn = text.match(/error on line \d+ at column \d+:\s*(.+)$/i);
  if (errorOn?.[1]) return errorOn[1].trim();
  return text;
}

class Writer {
  private buf = '';

  write(s: string): void {
    this.buf += s;
  }

  get offset(): number {
    return this.buf.length;
  }

  toString(): string {
    return this.buf;
  }
}

function serializeNode(
  node: Node,
  level: number,
  indent: string,
  threshold: number,
  writer: Writer,
  path: PathSegment[],
): AppTreeNode | null {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return serializeElement(
        node as Element,
        level,
        indent,
        threshold,
        writer,
        path,
      );
    case Node.TEXT_NODE:
    case Node.CDATA_SECTION_NODE:
      return serializeTextLike(node, level, indent, writer, path);
    case Node.COMMENT_NODE:
      return serializeComment(node as Comment, level, indent, writer, path);
    case Node.PROCESSING_INSTRUCTION_NODE:
      return serializePi(
        node as ProcessingInstruction,
        level,
        indent,
        writer,
        path,
      );
    default:
      return null;
  }
}

function serializeElement(
  el: Element,
  level: number,
  indent: string,
  threshold: number,
  writer: Writer,
  path: PathSegment[],
): AppTreeNode {
  const pad = indent.repeat(level);
  const name = el.tagName;
  const attrs: TreeAttr[] = Array.from(el.attributes).map((a) => ({
    name: a.name,
    value: a.value,
  }));
  const mixed = isMixedContent(el);
  const significant = significantChildren(el, mixed);
  const empty = significant.length === 0;

  writer.write(pad);
  const start = writer.offset;
  writeOpenTag(name, attrs, pad, indent, threshold, empty, writer);

  const elementKids = significant.filter((c) => c.nodeType === Node.ELEMENT_NODE);
  const names = elementKids.map((c) => (c as Element).tagName);
  const indexes = siblingIndexMap(names);
  let elementCursor = 0;

  const children: AppTreeNode[] = [];

  if (empty) {
    const end = writer.offset;
    return makeElementNode(el, attrs, children, start, end, path);
  }

  const onlyText =
    !mixed &&
    significant.length === 1 &&
    (significant[0].nodeType === Node.TEXT_NODE ||
      significant[0].nodeType === Node.CDATA_SECTION_NODE);

  if (onlyText) {
    const child = serializeNode(
      significant[0],
      0,
      indent,
      threshold,
      writer,
      [...path, { name }],
    );
    if (child) children.push(child);
    writer.write(`</${name}>`);
  } else if (mixed) {
    for (const child of Array.from(el.childNodes)) {
      const serialized = serializeMixed(
        child,
        indent,
        threshold,
        writer,
        [...path, { name }],
        names,
        indexes,
        () => elementCursor++,
      );
      if (serialized) children.push(serialized);
    }
    writer.write(`</${name}>`);
  } else {
    writer.write('\n');
    for (const child of significant) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        elementCursor += 1;
      }
      const serialized = serializeNode(
        child,
        level + 1,
        indent,
        threshold,
        writer,
        [...path, { name }],
      );
      if (serialized) children.push(serialized);
      writer.write('\n');
    }
    writer.write(pad);
    writer.write(`</${name}>`);
  }

  const end = writer.offset;
  return makeElementNode(el, attrs, children, start, end, path);
}

function writeOpenTag(
  name: string,
  attrs: TreeAttr[],
  pad: string,
  indent: string,
  threshold: number,
  selfClose: boolean,
  writer: Writer,
): string {
  const inlineAttrs = attrs.map((a) => `${a.name}="${escapeAttr(a.value)}"`);
  const closer = selfClose ? '/>' : '>';
  const inline = `<${name}${inlineAttrs.length ? ` ${inlineAttrs.join(' ')}` : ''}${closer}`;
  if (
    threshold > 0 &&
    pad.length + inline.length > threshold &&
    attrs.length > 0
  ) {
    writer.write(`<${name}`);
    for (const a of attrs) {
      writer.write('\n');
      writer.write(pad + indent);
      writer.write(`${a.name}="${escapeAttr(a.value)}"`);
    }
    writer.write(selfClose ? '/>' : '>');
    return inline;
  }
  writer.write(inline);
  return inline;
}

function makeElementNode(
  el: Element,
  attrs: TreeAttr[],
  children: AppTreeNode[],
  start: number,
  end: number,
  parentPath: PathSegment[],
): AppTreeNode {
  const name = el.tagName;
  const path = toXPath([...parentPath, { name }]);
  const textChild = children.find((c) => c.kind === 'text' || c.kind === 'cdata');
  return {
    id: `${start}:${name}`,
    kind: 'element',
    label: name,
    preview: textChild?.preview,
    attributes: attrs,
    children,
    start,
    end,
    path,
    childCount: children.filter((c) => c.kind === 'element').length,
  };
}

function serializeTextLike(
  node: Node,
  level: number,
  indent: string,
  writer: Writer,
  path: PathSegment[],
): AppTreeNode | null {
  const value = node.textContent ?? '';
  if (node.nodeType === Node.TEXT_NODE && !value.trim()) return null;
  const pad = level > 0 ? indent.repeat(level) : '';
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    if (pad) writer.write(pad);
    const start = writer.offset;
    writer.write(`<![CDATA[${value}]]>`);
    const end = writer.offset;
    return {
      id: `${start}:cdata`,
      kind: 'cdata',
      label: '#cdata',
      preview: value,
      attributes: [],
      children: [],
      start,
      end,
      path: toXPath([...path, { name: 'text()', kind: 'cdata' }]),
      childCount: 0,
    };
  }
  if (pad) writer.write(pad);
  const start = writer.offset;
  writer.write(escapeText(value.trim()));
  const end = writer.offset;
  return {
    id: `${start}:text`,
    kind: 'text',
    label: '#text',
    preview: value.trim(),
    attributes: [],
    children: [],
    start,
    end,
    path: toXPath([...path, { name: 'text()', kind: 'text' }]),
    childCount: 0,
  };
}

function serializeComment(
  node: Comment,
  level: number,
  indent: string,
  writer: Writer,
  path: PathSegment[],
): AppTreeNode {
  const pad = indent.repeat(level);
  writer.write(pad);
  const start = writer.offset;
  writer.write(`<!--${node.data}-->`);
  const end = writer.offset;
  return {
    id: `${start}:comment`,
    kind: 'comment',
    label: '#comment',
    preview: node.data.trim(),
    attributes: [],
    children: [],
    start,
    end,
    path: toXPath([...path, { name: 'comment()', kind: 'comment' }]),
    childCount: 0,
  };
}

function serializePi(
  node: ProcessingInstruction,
  level: number,
  indent: string,
  writer: Writer,
  path: PathSegment[],
): AppTreeNode {
  const pad = indent.repeat(level);
  writer.write(pad);
  const start = writer.offset;
  writer.write(`<?${node.target}${node.data ? ` ${node.data}` : ''}?>`);
  const end = writer.offset;
  return {
    id: `${start}:pi`,
    kind: 'pi',
    label: node.target,
    preview: node.data,
    attributes: [],
    children: [],
    start,
    end,
    path: toXPath([...path, { name: node.target, kind: 'pi' }]),
    childCount: 0,
  };
}

function serializeMixed(
  node: Node,
  indent: string,
  threshold: number,
  writer: Writer,
  path: PathSegment[],
  _elementNames: string[],
  indexes: ReturnType<typeof siblingIndexMap>,
  nextElement: () => number,
): AppTreeNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? '';
    if (!value) return null;
    const start = writer.offset;
    writer.write(escapeText(value));
    const end = writer.offset;
    return {
      id: `${start}:text`,
      kind: 'text',
      label: '#text',
      preview: value,
      attributes: [],
      children: [],
      start,
      end,
      path: toXPath([...path, { name: 'text()', kind: 'text' }]),
      childCount: 0,
    };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const i = nextElement();
    const sib = indexes[i];
    const el = node as Element;
    const child = serializeElement(el, 0, indent, threshold, writer, [
      ...path,
      { name: el.tagName, index: sib?.index },
    ]);
    child.siblingIndex = sib?.index;
    child.siblingCount = sib?.count;
    child.path = toXPath([...path, { name: el.tagName, index: sib?.index }]);
    return child;
  }
  return serializeNode(node, 0, indent, threshold, writer, path);
}

function significantChildren(el: Element, mixed: boolean): Node[] {
  return Array.from(el.childNodes).filter((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (mixed) return (n.textContent ?? '').length > 0;
      return (n.textContent ?? '').trim().length > 0;
    }
    return (
      n.nodeType === Node.ELEMENT_NODE ||
      n.nodeType === Node.CDATA_SECTION_NODE ||
      n.nodeType === Node.COMMENT_NODE ||
      n.nodeType === Node.PROCESSING_INSTRUCTION_NODE
    );
  });
}

function isMixedContent(el: Element): boolean {
  let hasText = false;
  let hasElement = false;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim()) {
      hasText = true;
    }
    if (n.nodeType === Node.ELEMENT_NODE) hasElement = true;
  }
  return hasText && hasElement;
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function minifyFromDocument(doc: Document, declaration?: string): string {
  const writer = new Writer();
  if (declaration) writer.write(declaration);
  for (const child of Array.from(doc.childNodes)) {
    if (isParserErrorNode(child)) continue;
    minifyNode(child, writer);
  }
  return writer.toString();
}

function minifyNode(node: Node, writer: Writer): void {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const el = node as Element;
      const attrs = Array.from(el.attributes)
        .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
        .join('');
      const kids = significantChildren(el, isMixedContent(el));
      if (kids.length === 0) {
        writer.write(`<${el.tagName}${attrs}/>`);
        return;
      }
      writer.write(`<${el.tagName}${attrs}>`);
      for (const kid of Array.from(el.childNodes)) {
        if (kid.nodeType === Node.TEXT_NODE) {
          const t = isMixedContent(el)
            ? (kid.textContent ?? '')
            : (kid.textContent ?? '').trim();
          if (t) writer.write(escapeText(t));
        } else if (
          kid.nodeType !== Node.DOCUMENT_TYPE_NODE &&
          !isParserErrorNode(kid)
        ) {
          minifyNode(kid, writer);
        }
      }
      writer.write(`</${el.tagName}>`);
      return;
    }
    case Node.TEXT_NODE: {
      const t = (node.textContent ?? '').trim();
      if (t) writer.write(escapeText(t));
      return;
    }
    case Node.CDATA_SECTION_NODE:
      writer.write(`<![CDATA[${node.textContent ?? ''}]]>`);
      return;
    case Node.COMMENT_NODE:
      writer.write(`<!--${(node as Comment).data}-->`);
      return;
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = node as ProcessingInstruction;
      writer.write(`<?${pi.target}${pi.data ? ` ${pi.data}` : ''}?>`);
      return;
    }
    case Node.DOCUMENT_TYPE_NODE: {
      const dt = node as DocumentType;
      writer.write(`<!DOCTYPE ${dt.name}>`);
      return;
    }
    default:
  }
}

export function nodeToXml(node: AppTreeNode, indent: string, level = 0): string {
  const pad = indent.repeat(level);
  if (node.kind === 'comment') return `${pad}<!--${node.preview ?? ''}-->`;
  if (node.kind === 'cdata') return `${pad}<![CDATA[${node.preview ?? ''}]]>`;
  if (node.kind === 'pi') return `${pad}<?${node.label} ${node.preview ?? ''}?>`;
  if (node.kind === 'text') return `${pad}${escapeText(node.preview ?? '')}`;
  const attrs = node.attributes
    .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join('');
  const elements = node.children;
  if (elements.length === 0 && !node.preview) {
    return `${pad}<${node.label}${attrs}/>`;
  }
  const onlyText =
    elements.length === 0 ||
    (elements.length === 1 &&
      (elements[0].kind === 'text' || elements[0].kind === 'cdata'));
  if (onlyText) {
    const inner =
      elements[0]?.kind === 'cdata'
        ? `<![CDATA[${elements[0].preview ?? ''}]]>`
        : escapeText(elements[0]?.preview ?? node.preview ?? '');
    return `${pad}<${node.label}${attrs}>${inner}</${node.label}>`;
  }
  const kids = elements
    .map((c) => nodeToXml(c, indent, level + 1))
    .join('\n');
  return `${pad}<${node.label}${attrs}>\n${kids}\n${pad}</${node.label}>`;
}

