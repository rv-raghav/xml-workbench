import { describe, expect, it } from 'vitest';
import {
  formatJson,
  parseJson,
  unescapeAndFormatJson,
} from './jsonFormatter';
import { extractJsonPayload } from './extractPayload';

const options = { indent: 2 as const, attributeWrapThreshold: 80 };

describe('formatJson', () => {
  it('formats and minifies JSON', () => {
    const result = formatJson('{"b":2,"a":{"z":true,"n":null}}', options);
    expect(result.error).toBeNull();
    expect(result.formatted).toContain('\n');
    expect(result.formatted).toContain('"b": 2');
    expect(result.minified).toBe('{"b":2,"a":{"z":true,"n":null}}');
    expect(result.tree?.kind).toBe('object');
  });

  it('sorts keys when requested', () => {
    const result = formatJson('{"b":1,"a":2}', { ...options, sortKeys: true });
    expect(result.formatted.indexOf('"a"')).toBeLessThan(
      result.formatted.indexOf('"b"'),
    );
  });

  it('extracts JSON from a log line', () => {
    const line = 'INFO user=raghav payload={"ok":true,"n":1} done';
    expect(extractJsonPayload(line).payload).toBe('{"ok":true,"n":1}');
    const result = formatJson(line, options);
    expect(result.extracted).toBe(true);
    expect(result.error).toBeNull();
    expect(result.formatted).toContain('"ok": true');
  });

  it('reports error position for malformed JSON', () => {
    const input = '{"a":1,}';
    const parsed = parseJson(input);
    expect(parsed.error).not.toBeNull();
    expect(parsed.error?.line).toBeGreaterThanOrEqual(1);
    expect(parsed.error?.column).toBeGreaterThanOrEqual(1);
    const result = formatJson(input, options);
    expect(result.error?.message).toBeTruthy();
  });

  it('unescapes double-encoded JSON', () => {
    const encoded = JSON.stringify('{"hello":"world","n":3}');
    expect(encoded.startsWith('"')).toBe(true);
    const result = unescapeAndFormatJson(encoded, options);
    expect(result.error).toBeNull();
    expect(result.formatted).toContain('"hello": "world"');
    expect(result.tree?.childCount).toBe(2);
  });
});
