import { describe, expect, it } from 'vitest';
import { formatQuotedList, parseListItems } from './listFormatter';

describe('formatQuotedList', () => {
  it('wraps each line in single quotes with trailing commas except the last', () => {
    const input = Array.from({ length: 15 }, () => '3564313-3').join('\n');
    const result = formatQuotedList(input);
    const lines = result.formatted.trimEnd().split('\n');
    expect(lines).toHaveLength(15);
    expect(lines.slice(0, 14).every((line) => line === "'3564313-3',")).toBe(
      true,
    );
    expect(lines[14]).toBe("'3564313-3'");
    expect(result.minified).toBe(
      Array.from({ length: 15 }, () => "'3564313-3'").join(','),
    );
  });

  it('skips blank lines and strips existing quotes', () => {
    const result = formatQuotedList(`'a'\n\n"b"\n c `);
    expect(parseListItems(`'a'\n\n"b"\n c `)).toEqual(['a', 'b', 'c']);
    expect(result.formatted).toBe("'a',\n'b',\n'c'\n");
  });

  it('splits comma-separated values on one line', () => {
    const result = formatQuotedList('x, y, z');
    expect(result.formatted.trim()).toBe("'x',\n'y',\n'z'");
  });
});
