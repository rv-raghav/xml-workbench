export interface ExtractResult {
  payload: string;
  trimmed: boolean;
}

export function extractXmlPayload(input: string): ExtractResult {
  const start = input.indexOf('<');
  const end = input.lastIndexOf('>');
  if (start === -1 || end === -1 || end <= start) {
    return { payload: input, trimmed: false };
  }
  const payload = input.slice(start, end + 1);
  const prefix = input.slice(0, start);
  const suffix = input.slice(end + 1);
  const trimmed = /\S/.test(prefix) || /\S/.test(suffix);
  return { payload, trimmed };
}

export function extractJsonPayload(input: string): ExtractResult {
  const firstObj = input.indexOf('{');
  const firstArr = input.indexOf('[');
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);

  const lastObj = input.lastIndexOf('}');
  const lastArr = input.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);

  if (start === -1 || end === -1 || end <= start) {
    return { payload: input, trimmed: false };
  }
  const payload = input.slice(start, end + 1);
  const prefix = input.slice(0, start);
  const suffix = input.slice(end + 1);
  const trimmed = /\S/.test(prefix) || /\S/.test(suffix);
  return { payload, trimmed };
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&amp;/g, '&');
}

export function unescapeJsString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

export function looksLikeEscapedXml(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/&lt;\/?[A-Za-z_:]/.test(trimmed) && /&gt;/.test(trimmed)) return true;
  if (/^["']/.test(trimmed) && /&lt;|\\u003c|\\n/.test(trimmed)) return true;
  if (/\\[nrt"]/.test(trimmed) && /<[^>]+>/.test(unescapeJsString(trimmed))) {
    return true;
  }
  return false;
}

export function looksLikeEscapedJson(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === 'string' && looksLikeJsonText(parsed);
    } catch {
      return /\\[n"{[]/.test(trimmed);
    }
  }
  return false;
}

export function looksLikeJsonText(value: string): boolean {
  const t = value.trim();
  return (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  );
}

export function unescapePayload(input: string): string {
  let value = input.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      const parsed: unknown = JSON.parse(
        value.startsWith("'") ? `"${value.slice(1, -1)}"` : value,
      );
      if (typeof parsed === 'string') value = parsed;
    } catch {
      value = unescapeJsString(value.slice(1, -1));
    }
  } else if (/\\[nrt"]/.test(value)) {
    value = unescapeJsString(value);
  }
  if (/&lt;|&gt;|&amp;/.test(value)) {
    value = decodeXmlEntities(value);
  }
  return value;
}
