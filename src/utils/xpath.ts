export interface PathSegment {
  name: string;
  index?: number;
  kind?: 'element' | 'text' | 'comment' | 'cdata' | 'pi' | 'attribute';
}

export function toXPath(segments: PathSegment[]): string {
  if (segments.length === 0) return '/';
  return `/${segments
    .map((seg) => {
      if (seg.kind === 'attribute') return `@${seg.name}`;
      if (seg.kind === 'text') return 'text()';
      if (seg.kind === 'comment') {
        return seg.index ? `comment()[${seg.index}]` : 'comment()';
      }
      if (seg.kind === 'cdata') {
        return seg.index ? `text()[${seg.index}]` : 'text()';
      }
      if (seg.kind === 'pi') {
        return seg.index
          ? `processing-instruction()[${seg.index}]`
          : 'processing-instruction()';
      }
      return seg.index ? `${seg.name}[${seg.index}]` : seg.name;
    })
    .join('/')}`;
}

export function jsonPath(segments: Array<string | number>): string {
  if (segments.length === 0) return '$';
  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (!out) {
      out = seg;
    } else if (/^[A-Za-z_$][\w$]*$/.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

export function siblingIndexMap(names: string[]): Array<{
  index?: number;
  count: number;
}> {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = counts.get(name) ?? 1;
    const next = (seen.get(name) ?? 0) + 1;
    seen.set(name, next);
    return {
      count,
      index: count > 1 ? next : undefined,
    };
  });
}
