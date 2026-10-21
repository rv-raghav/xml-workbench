import type { FormatError, FormatOptions, FormatResult } from '../types';
import {
  extractJsonPayload,
  looksLikeEscapedJson,
  looksLikeJsonText,
  unescapePayload,
} from './extractPayload';
import { positionFromIndex } from './indent';
import { jsonToTree } from './jsonToTree';

export function formatJson(
  input: string,
  options: FormatOptions,
  alreadyUnescaped = false,
): FormatResult {
  const extracted = extractJsonPayload(input);
  const payload = extracted.payload;
  const canUnescape =
    !alreadyUnescaped &&
    (looksLikeEscapedJson(payload) || isDoubleEncodedJson(payload));
  const notices: FormatResult['notices'] = [];
  if (extracted.trimmed) {
    notices.push({
      kind: 'trimmed',
      message: 'Trimmed non-JSON text from input',
    });
  }
  if (canUnescape) {
    notices.push({
      kind: 'escaped',
      message: 'Input looks escaped. Use Unescape and format.',
    });
  }

  const parsed = parseJson(payload);
  if (parsed.error) {
    return {
      formatted: payload,
      minified: payload,
      tree: null,
      error: parsed.error,
      notices,
      canUnescape,
      usedLenient: false,
      extracted: extracted.trimmed,
    };
  }

  const space = options.indent === 'tab' ? '\t' : options.indent;
  const value = options.sortKeys
    ? sortKeys(parsed.value)
    : parsed.value;
  const formatted = `${JSON.stringify(value, null, space)}\n`;
  const minified = JSON.stringify(value);
  return {
    formatted,
    minified,
    tree: jsonToTree(value, formatted),
    error: null,
    notices,
    canUnescape,
    usedLenient: false,
    extracted: extracted.trimmed,
  };
}

export function unescapeAndFormatJson(
  input: string,
  options: FormatOptions,
): FormatResult {
  const extracted = extractJsonPayload(input);
  let payload = unescapePayload(extracted.payload);
  const once = parseJson(payload);
  if (!once.error && typeof once.value === 'string' && looksLikeJsonText(once.value)) {
    payload = once.value;
  }
  const result = formatJson(payload, options, true);
  if (extracted.trimmed && !result.notices.some((n) => n.kind === 'trimmed')) {
    result.notices.unshift({
      kind: 'trimmed',
      message: 'Trimmed non-JSON text from input',
    });
  }
  return result;
}

export function isDoubleEncodedJson(input: string): boolean {
  const parsed = parseJson(input.trim());
  return !parsed.error && typeof parsed.value === 'string' && looksLikeJsonText(parsed.value);
}

export function parseJson(text: string): {
  value: unknown;
  error: FormatError | null;
} {
  try {
    return { value: JSON.parse(text) as unknown, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const posMatch = message.match(/position\s+(\d+)/i);
    const lineMatch = message.match(/line\s+(\d+)/i);
    const colMatch = message.match(/column\s+(\d+)/i);
    let line = 1;
    let column = 1;
    let index = 0;
    if (posMatch) {
      index = Number(posMatch[1]);
      const pos = positionFromIndex(text, index);
      line = pos.line;
      column = pos.column;
    } else if (lineMatch) {
      line = Number(lineMatch[1]);
      column = colMatch ? Number(colMatch[1]) : 1;
    }
    return {
      value: null,
      error: {
        message: message.replace(/^JSON\.parse:\s*/i, ''),
        line,
        column,
        index,
      },
    };
  }
}

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}
