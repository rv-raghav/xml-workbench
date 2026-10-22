import {
  EditorSelection,
  EditorState,
  Prec,
  type ChangeSpec,
} from '@codemirror/state';
import {
  EditorView,
  keymap,
  type Command,
  type KeyBinding,
} from '@codemirror/view';
import { selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';

interface LineEdit {
  lines: string[];
  selected: Set<number>;
}

function coveredLineNumbers(state: EditorState): number[] {
  const nums = new Set<number>();
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(range.from).number;
    let endPos = range.to;
    if (!range.empty && endPos > range.from) {
      const prev = state.doc.sliceString(endPos - 1, endPos);
      if (prev === '\n') endPos -= 1;
    }
    const end = state.doc.lineAt(Math.max(range.from, endPos)).number;
    for (let n = start; n <= end; n += 1) nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}

function readLines(state: EditorState): string[] {
  const lines: string[] = [];
  for (let n = 1; n <= state.doc.lines; n += 1) lines.push(state.doc.line(n).text);
  return lines;
}

function applyLineEdit(view: EditorView, edit: (current: LineEdit) => LineEdit): boolean {
  const current: LineEdit = {
    lines: readLines(view.state),
    selected: new Set(coveredLineNumbers(view.state).map((n) => n - 1)),
  };
  const next = edit(current);
  const trailing = view.state.doc.toString().endsWith('\n');
  const text = next.lines.join('\n') + (trailing ? '\n' : '');
  let pos = 0;
  const ranges = next.lines.flatMap((line, index) => {
    const cursor = EditorSelection.cursor(Math.min(pos, text.length));
    pos += line.length + 1;
    return next.selected.has(index) ? [cursor] : [];
  });
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: ranges.length
      ? EditorSelection.create(ranges, ranges.length - 1)
      : undefined,
    scrollIntoView: true,
    userEvent: 'input',
  });
  return true;
}

function addCursor(view: EditorView, dir: -1 | 1): boolean {
  const ranges = view.state.selection.ranges;
  const pivot =
    dir < 0
      ? ranges.reduce((a, b) => (a.from <= b.from ? a : b))
      : ranges.reduce((a, b) => (a.to >= b.to ? a : b));
  const line = view.state.doc.lineAt(dir < 0 ? pivot.from : pivot.head);
  const targetNo = line.number + dir;
  if (targetNo < 1 || targetNo > view.state.doc.lines) return false;
  const target = view.state.doc.line(targetNo);
  const column = Math.max(0, pivot.head - line.from);
  const pos = Math.min(target.from + column, target.to);
  if (ranges.some((range) => range.empty && range.head === pos)) return true;
  view.dispatch({
    selection: EditorSelection.create([...ranges, EditorSelection.cursor(pos)], ranges.length),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

function cursorsOnLines(view: EditorView, edge: 'start' | 'end'): boolean {
  const lines = coveredLineNumbers(view.state);
  if (lines.length === 0) return false;
  const ranges = lines.map((n) => {
    const line = view.state.doc.line(n);
    return EditorSelection.cursor(edge === 'start' ? line.from : line.to);
  });
  view.dispatch({
    selection: EditorSelection.create(ranges, ranges.length - 1),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

function moveSelected(edit: LineEdit, dir: -1 | 1): LineEdit {
  const lines = edit.lines.slice();
  const selected = new Set(edit.selected);
  const order = [...selected].sort((a, b) => (dir < 0 ? a - b : b - a));
  for (const index of order) {
    const next = index + dir;
    if (next < 0 || next >= lines.length || selected.has(next)) continue;
    [lines[index], lines[next]] = [lines[next], lines[index]];
    selected.delete(index);
    selected.add(next);
  }
  return { lines, selected };
}

export const addCursorAbove: Command = (view) => addCursor(view, -1);
export const addCursorBelow: Command = (view) => addCursor(view, 1);

function columnCorners(state: EditorState): {
  anchorLine: number;
  headLine: number;
  anchorCol: number;
  headCol: number;
} {
  const ranges = state.selection.ranges;
  const main = state.selection.main;
  const headLine = state.doc.lineAt(main.head).number;
  const headCol = main.head - state.doc.lineAt(main.head).from;
  let anchorLine = state.doc.lineAt(main.anchor).number;
  let anchorCol = main.anchor - state.doc.lineAt(main.anchor).from;
  if (ranges.length > 1) {
    const first = state.doc.lineAt(ranges[0].from).number;
    const last = state.doc.lineAt(ranges[ranges.length - 1].from).number;
    anchorLine = headLine === first ? last : first;
    const anchorRange = headLine === first ? ranges[ranges.length - 1] : ranges[0];
    const anchorAt = anchorRange.anchor <= anchorRange.head ? anchorRange.from : anchorRange.to;
    anchorCol = anchorAt - state.doc.lineAt(anchorAt).from;
  }
  return { anchorLine, headLine, anchorCol, headCol };
}

/** Keyboard form of Alt+drag: extend a column selection without changing the text. */
export function extendColumnSelection(
  view: EditorView,
  deltaLine: number,
  deltaCol = 0,
): boolean {
  const { state } = view;
  const current = columnCorners(state);
  const headLine = Math.max(1, Math.min(state.doc.lines, current.headLine + deltaLine));
  const headCol = Math.max(0, current.headCol + deltaCol);
  const lineStart = Math.min(current.anchorLine, headLine);
  const lineEnd = Math.max(current.anchorLine, headLine);
  const ranges = [];
  let mainIndex = 0;
  for (let n = lineStart; n <= lineEnd; n += 1) {
    const line = state.doc.line(n);
    const anchorPos = line.from + Math.min(current.anchorCol, line.length);
    const headPos = line.from + Math.min(headCol, line.length);
    if (n === headLine) mainIndex = ranges.length;
    ranges.push(
      n === headLine || n === current.anchorLine
        ? EditorSelection.range(anchorPos, headPos)
        : EditorSelection.range(
            line.from + Math.min(Math.min(current.anchorCol, headCol), line.length),
            line.from + Math.min(Math.max(current.anchorCol, headCol), line.length),
          ),
    );
  }
  view.dispatch({
    selection: EditorSelection.create(ranges, mainIndex),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

const extendColumnUp: Command = (view) => extendColumnSelection(view, -1, 0);
const extendColumnDown: Command = (view) => extendColumnSelection(view, 1, 0);
const extendColumnLeft: Command = (view) => extendColumnSelection(view, 0, -1);
const extendColumnRight: Command = (view) => extendColumnSelection(view, 0, 1);
export const cursorsAtLineStarts: Command = (view) => cursorsOnLines(view, 'start');
export const cursorsAtLineEnds: Command = (view) => cursorsOnLines(view, 'end');

export const duplicateLines: Command = (view) =>
  applyLineEdit(view, ({ lines, selected }) => {
    const next: string[] = [];
    const kept = new Set<number>();
    lines.forEach((line, index) => {
      next.push(line);
      if (selected.has(index)) {
        next.push(line);
        kept.add(next.length - 1);
      }
    });
    return { lines: next, selected: kept };
  });

export const deleteLines: Command = (view) =>
  applyLineEdit(view, ({ lines, selected }) => {
    const next = lines.filter((_, index) => !selected.has(index));
    const cursor = Math.min(...selected);
    const at = Math.max(0, Math.min(cursor, Math.max(0, next.length - 1)));
    return {
      lines: next.length ? next : [''],
      selected: new Set(next.length ? [at] : [0]),
    };
  });

export const moveLinesUp: Command = (view) =>
  applyLineEdit(view, (edit) => moveSelected(edit, -1));

export const moveLinesDown: Command = (view) =>
  applyLineEdit(view, (edit) => moveSelected(edit, 1));

export const joinLines: Command = (view) =>
  applyLineEdit(view, ({ lines, selected }) => {
    const next: string[] = [];
    const kept = new Set<number>();
    let index = 0;
    while (index < lines.length) {
      if (!selected.has(index)) {
        next.push(lines[index]);
        index += 1;
        continue;
      }
      const parts = [lines[index].trimEnd()];
      let cursor = index + 1;
      while (cursor < lines.length && selected.has(cursor)) {
        parts.push(lines[cursor].trim());
        cursor += 1;
      }
      next.push(parts.filter((part) => part.length > 0).join(' '));
      kept.add(next.length - 1);
      index = cursor;
    }
    return { lines: next, selected: kept };
  });

function sortSelected(edit: LineEdit, direction: 1 | -1): LineEdit {
  const indexes = [...edit.selected].sort((a, b) => a - b);
  const span = indexes.length > 1 ? indexes : edit.lines.map((_, index) => index);
  const sorted = span
    .map((index) => edit.lines[index])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }) * direction);
  const lines = edit.lines.slice();
  span.forEach((index, offset) => {
    lines[index] = sorted[offset];
  });
  return { lines, selected: new Set(span) };
}

export const sortLinesAsc: Command = (view) =>
  applyLineEdit(view, (edit) => sortSelected(edit, 1));

export const sortLinesDesc: Command = (view) =>
  applyLineEdit(view, (edit) => sortSelected(edit, -1));

export const trimTrailingSpace: Command = (view) =>
  applyLineEdit(view, ({ lines, selected }) => ({
    lines: lines.map((line) => line.replace(/[ \t]+$/g, '')),
    selected,
  }));

export const removeEmptyLines: Command = (view) =>
  applyLineEdit(view, ({ lines }) => {
    const next = lines.filter((line) => line.trim().length > 0);
    return { lines: next.length ? next : [''], selected: new Set([0]) };
  });

function replaceText(view: EditorView, map: (value: string) => string): boolean {
  const ranges = view.state.selection.ranges.filter((range) => !range.empty);
  const changes: ChangeSpec[] =
    ranges.length > 0
      ? ranges.map((range) => ({
          from: range.from,
          to: range.to,
          insert: map(view.state.sliceDoc(range.from, range.to)),
        }))
      : coveredLineNumbers(view.state).map((n) => {
          const line = view.state.doc.line(n);
          return { from: line.from, to: line.to, insert: map(line.text) };
        });
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: 'input' });
  return true;
}

export const uppercaseSelection: Command = (view) =>
  replaceText(view, (value) => value.toUpperCase());

export const lowercaseSelection: Command = (view) =>
  replaceText(view, (value) => value.toLowerCase());

export { selectNextOccurrence, selectSelectionMatches };

const bindings: KeyBinding[] = [
  { key: 'Alt-Shift-ArrowUp', run: extendColumnUp, preventDefault: true },
  { key: 'Alt-Shift-ArrowDown', run: extendColumnDown, preventDefault: true },
  { key: 'Alt-Shift-ArrowLeft', run: extendColumnLeft, preventDefault: true },
  { key: 'Alt-Shift-ArrowRight', run: extendColumnRight, preventDefault: true },
  { key: 'Alt-ArrowUp', run: addCursorAbove, preventDefault: true },
  { key: 'Alt-ArrowDown', run: addCursorBelow, preventDefault: true },
  { key: 'Shift-Alt-i', run: cursorsAtLineEnds, preventDefault: true },
  { key: 'Shift-Alt-a', run: cursorsAtLineStarts, preventDefault: true },
  { key: 'Ctrl-Alt-ArrowUp', run: moveLinesUp, preventDefault: true },
  { key: 'Ctrl-Alt-ArrowDown', run: moveLinesDown, preventDefault: true },
  { key: 'Mod-Shift-d', run: duplicateLines, preventDefault: true },
  { key: 'Mod-Shift-k', run: deleteLines, preventDefault: true },
  { key: 'Mod-j', run: joinLines, preventDefault: true },
];

export const notepadKeymap = Prec.high(keymap.of(bindings));
