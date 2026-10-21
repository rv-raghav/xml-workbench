import { describe, expect, it } from 'vitest';
import { formatXml, unescapeAndFormatXml } from './xmlFormatter';
import { extractXmlPayload } from './extractPayload';
import { collectMatches, findNodeById } from './xmlToTree';

const options = { indent: 2 as const, attributeWrapThreshold: 120 };

describe('formatXml', () => {
  it('formats single-line XML with nested elements, attributes, namespaces, CDATA and comments', () => {
    const input =
      '<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn:orders"><soap:Body><!-- lookup --><ns:GetOrder id="42"><ns:Name>John</ns:Name><ns:Note><![CDATA[a < b & c]]></ns:Note></ns:GetOrder></soap:Body></soap:Envelope>';
    const result = formatXml(input, options);
    expect(result.error).toBeNull();
    expect(result.formatted).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.formatted).toMatch(/<ns:Name>John<\/ns:Name>/);
    expect(result.formatted).toContain('<!-- lookup -->');
    expect(result.formatted).toContain('<![CDATA[a < b & c]]>');
    expect(result.formatted).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(result.formatted).toContain('xmlns:ns="urn:orders"');
    expect(result.formatted).toContain('id="42"');
    expect(result.formatted).toMatch(/<soap:Envelope[\s\S]*<soap:Body>/);
    expect(result.tree?.label).toBe('soap:Envelope');
    expect(result.minified).not.toContain('\n');
  });

  it('extracts XML from a log line with prefix and suffix', () => {
    const line =
      '2026-01-01 12:00:00 INFO [thread-1] <Order id="1"><Item sku="A">1</Item></Order> elapsed=3ms';
    const extracted = extractXmlPayload(line);
    expect(extracted.trimmed).toBe(true);
    expect(extracted.payload).toBe(
      '<Order id="1"><Item sku="A">1</Item></Order>',
    );
    const result = formatXml(line, options);
    expect(result.extracted).toBe(true);
    expect(result.notices.some((n) => n.kind === 'trimmed')).toBe(true);
    expect(result.formatted).toMatch(/<Item sku="A">1<\/Item>/);
  });

  it('reports malformed XML with line and column and uses lenient indent', () => {
    const input = '<root>\n  <item>\n</root>';
    const result = formatXml(input, options);
    expect(result.error).not.toBeNull();
    expect(result.error?.line).toBeGreaterThanOrEqual(1);
    expect(result.error?.column).toBeGreaterThanOrEqual(1);
    expect(result.usedLenient).toBe(true);
    expect(result.formatted).toContain('<root>');
    expect(result.formatted).toContain('<item>');
  });

  it('unescapes entity-encoded XML', () => {
    const input = '&lt;root&gt;&lt;name&gt;Ada&lt;/name&gt;&lt;/root&gt;';
    const result = unescapeAndFormatXml(input, options);
    expect(result.error).toBeNull();
    expect(result.formatted).toMatch(/<name>Ada<\/name>/);
  });
});

describe('xml tree + xpath', () => {
  it('generates depth, child counts and indexed sibling XPaths', () => {
    const xml =
      '<Order><Item>a</Item><Item>b</Item><Item>c</Item><Meta><Note>x</Note></Meta></Order>';
    const result = formatXml(xml, options);
    expect(result.tree).not.toBeNull();
    const tree = result.tree!;
    expect(tree.label).toBe('Order');
    expect(tree.childCount).toBe(4);
    const items = tree.children.filter((c) => c.label === 'Item');
    expect(items).toHaveLength(3);
    expect(items[2].path).toBe('/Order/Item[3]');
    expect(items[2].siblingIndex).toBe(3);
    const meta = tree.children.find((c) => c.label === 'Meta');
    expect(meta?.path).toBe('/Order/Meta');
    expect(meta?.children[0]?.path).toBe('/Order/Meta/Note');
    expect(meta?.children[0]?.preview).toBe('x');
    const matches = collectMatches(tree, 'item');
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(findNodeById(tree, items[0].id)?.label).toBe('Item');
  });
});
