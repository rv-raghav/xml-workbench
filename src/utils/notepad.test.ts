import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addCursorBelow,
  cursorsAtLineEnds,
  notepadKeymap,
  extendColumnSelection,
  deleteLines,
  duplicateLines,
  joinLines,
  lowercaseSelection,
  moveLinesDown,
  moveLinesUp,
  removeEmptyLines,
  sortLinesAsc,
  trimTrailingSpace,
  uppercaseSelection,
} from './notepad';

const views: EditorView[] = [];

function open(doc: string, head = 0): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(head),
      extensions: [EditorState.allowMultipleSelections.of(true)],
    }),
  });
  views.push(view);
  return view;
}

afterEach(() => {
  for (const view of views) {
    view.dom.remove();
    view.destroy();
  }
  views.length = 0;
});

describe('notepad multi-cursor and line edits', () => {
  it('extends a column with Alt+Shift+ArrowDown and does not copy the line', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'alpha\nbeta\ngamma',
        selection: EditorSelection.range(1, 4),
        extensions: [EditorState.allowMultipleSelections.of(true), notepadKeymap],
      }),
    });
    views.push(view);
    const original = view.state.doc.toString();
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(view.state.doc.toString()).toBe(original);
    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [1, 4],
      [7, 10],
    ]);
  });

  it('extends the same column upward without changing the text', () => {
    const view = open('alpha\nbeta\ngamma', 8);
    const original = view.state.doc.toString();
    expect(extendColumnSelection(view, -1)).toBe(true);
    expect(view.state.doc.toString()).toBe(original);
    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [2, 2],
      [8, 8],
    ]);
  });

  it('adds a cursor on the next line at the same column', () => {
    const view = open('alpha\nbeta\ngamma', 2);
    expect(addCursorBelow(view)).toBe(true);
    expect(addCursorBelow(view)).toBe(true);
    expect(view.state.selection.ranges.map((range) => range.head)).toEqual([2, 8, 13]);
  });

  it('puts a cursor at the end of every selected line', () => {
    const view = open('one\ntwo\nthree', 0);
    view.dispatch({
      selection: EditorSelection.range(0, view.state.doc.line(2).to),
    });
    expect(cursorsAtLineEnds(view)).toBe(true);
    expect(view.state.selection.ranges.map((range) => range.head)).toEqual([3, 7]);
  });

  it('duplicates, moves, and deletes lines', () => {
    const view = open('a\nb\nc', 2);
    duplicateLines(view);
    expect(view.state.doc.toString()).toBe('a\nb\nb\nc');
    moveLinesDown(view);
    expect(view.state.doc.toString()).toBe('a\nb\nc\nb');
    moveLinesUp(view);
    expect(view.state.doc.toString()).toBe('a\nb\nb\nc');
    deleteLines(view);
    expect(view.state.doc.toString()).toBe('a\nb\nc');
  });

  it('joins, sorts, trims, and drops empty lines', () => {
    const view = open('c \n a\nb\n\n', 0);
    view.dispatch({ selection: EditorSelection.range(0, 4) });
    joinLines(view);
    expect(view.state.doc.toString().startsWith('c a')).toBe(true);

    const sorted = open('10\n2\n1', 0);
    sortLinesAsc(sorted);
    expect(sorted.state.doc.toString()).toBe('1\n2\n10');

    const padded = open('keep  \nnext\t', 0);
    trimTrailingSpace(padded);
    expect(padded.state.doc.toString()).toBe('keep\nnext');

    const blanks = open('a\n\n b \n', 0);
    removeEmptyLines(blanks);
    expect(blanks.state.doc.toString()).toBe('a\n b \n');
  });

  it('changes case for the selection and for the current line', () => {
    const selected = open('Hello', 0);
    selected.dispatch({ selection: EditorSelection.range(0, 5) });
    uppercaseSelection(selected);
    expect(selected.state.doc.toString()).toBe('HELLO');

    const line = open('World', 1);
    lowercaseSelection(line);
    expect(line.state.doc.toString()).toBe('world');
  });
});
