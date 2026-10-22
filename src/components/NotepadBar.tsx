import type { StateCommand } from '@codemirror/state';
import type { Command } from '@codemirror/view';

type EditorCommand = Command | StateCommand;
import {
  addCursorAbove,
  addCursorBelow,
  cursorsAtLineEnds,
  cursorsAtLineStarts,
  deleteLines,
  duplicateLines,
  joinLines,
  lowercaseSelection,
  moveLinesDown,
  moveLinesUp,
  removeEmptyLines,
  selectNextOccurrence,
  selectSelectionMatches,
  sortLinesAsc,
  sortLinesDesc,
  trimTrailingSpace,
  uppercaseSelection,
} from '../utils/notepad';

interface NotepadBarProps {
  onRun: (command: EditorCommand) => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
}

export function NotepadBar({ onRun, onCopy, onDownload, onClear }: NotepadBarProps) {
  const button = (label: string, command: EditorCommand, title: string) => (
    <button type="button" title={title} onClick={() => onRun(command)}>
      {label}
    </button>
  );

  return (
    <div className="toolbar notepad-bar">
      <div className="toolbar-actions notepad-actions">
        {button('Cursor up', addCursorAbove, 'Alt+Up — add a cursor on the line above')}
        {button('Cursor down', addCursorBelow, 'Alt+Down — add a cursor on the line below')}
        {button('Ends', cursorsAtLineEnds, 'Shift+Alt+I — cursor at the end of each selected line')}
        {button('Starts', cursorsAtLineStarts, 'Shift+Alt+A — cursor at the start of each selected line')}
        {button('Next match', selectNextOccurrence, 'Ctrl+D — select the next copy of the current word')}
        {button('All matches', selectSelectionMatches, 'Ctrl+Shift+L — select every copy')}
        {button('Duplicate', duplicateLines, 'Ctrl+Shift+D — duplicate the current lines')}
        {button('Move up', moveLinesUp, 'Ctrl+Alt+Up — move the lines up')}
        {button('Move down', moveLinesDown, 'Ctrl+Alt+Down — move the lines down')}
        {button('Delete lines', deleteLines, 'Ctrl+Shift+K — delete the current lines')}
        {button('Join', joinLines, 'Ctrl+J — join the selected lines')}
        {button('Sort A–Z', sortLinesAsc, 'Sort the selected lines, or the whole note')}
        {button('Sort Z–A', sortLinesDesc, 'Sort the selected lines in reverse')}
        {button('Trim', trimTrailingSpace, 'Trim trailing spaces')}
        {button('Drop empty', removeEmptyLines, 'Remove empty lines')}
        {button('UPPER', uppercaseSelection, 'Uppercase the selection or current line')}
        {button('lower', lowercaseSelection, 'Lowercase the selection or current line')}
        <button type="button" onClick={onCopy}>
          Copy
        </button>
        <button type="button" onClick={onDownload}>
          Download
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <p className="notepad-hint">
        Alt+drag, or Alt+Shift+arrow keys, selects a column and leaves the text in place.
        Alt+↑/↓ adds another cursor. Arrow keys move every cursor together.
      </p>
    </div>
  );
}
