import type { FormatResult } from '../types';

export function parseListItems(input: string): string[] {
  return input
    .split(/\r?\n/)
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .map((item) => item.replace(/^['"]+|['"]+$/g, '').trim())
    .filter(Boolean);
}

export function formatQuotedList(input: string): FormatResult {
  const items = parseListItems(input);
  const quoted = items.map((item) => `'${item.replace(/'/g, "''")}'`);
  const formatted = quoted.length
    ? quoted.map((item, i) => (i < quoted.length - 1 ? `${item},` : item)).join('\n') +
      '\n'
    : '';
  const minified = quoted.join(',');
  return {
    formatted,
    minified,
    tree: null,
    error: null,
    notices: [],
    canUnescape: false,
    usedLenient: false,
    extracted: false,
  };
}
