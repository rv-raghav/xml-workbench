import type { IndentSize } from '../types';

export function indentString(size: IndentSize): string {
  return size === 'tab' ? '\t' : ' '.repeat(size);
}

export function positionFromIndex(
  text: string,
  index: number,
): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < safe; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function indexFromLineColumn(
  text: string,
  line: number,
  column: number,
): number {
  let currentLine = 1;
  let i = 0;
  while (i < text.length && currentLine < line) {
    if (text[i] === '\n') currentLine += 1;
    i += 1;
  }
  return Math.min(text.length, i + Math.max(0, column - 1));
}
