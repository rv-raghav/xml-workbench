import type { Extension } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFormat } from '../hooks/useFormat';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import type { FormatOptions, TabState } from '../types';
import { findNodeById, findNodeByOffset } from '../utils/xmlToTree';
import { ErrorBar } from './ErrorBar';

const CodeEditor = lazy(() =>
  import('./CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

interface EditorPanelProps {
  tab: TabState;
}

export function EditorPanel({ tab }: EditorPanelProps) {
  const settings = useWorkbenchStore((s) => s.settings);
  const updateTab = useWorkbenchStore((s) => s.updateTab);
  const applyFormat = useWorkbenchStore((s) => s.applyFormat);
  const toast = useWorkbenchStore((s) => s.toast);
  const { formatAsync } = useFormat();
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const tabRef = useRef(tab);
  const runFormatRef = useRef<(unescape?: boolean, fromPaste?: string) => void>(
    () => undefined,
  );

  const options: FormatOptions = {
    indent: settings.indentSize,
    attributeWrapThreshold: settings.attributeWrapThreshold,
  };

  const value = tab.editorView === 'input' ? tab.raw : tab.formatted;

  const runFormat = async (unescape = false, fromPaste?: string) => {
    const live = cmRef.current?.view?.state.doc.toString();
    const source =
      fromPaste ??
      live ??
      (tab.editorView === 'formatted' ? tab.formatted || tab.raw : tab.raw);
    updateTab(tab.id, { isFormatting: true, raw: fromPaste ?? live ?? tab.raw });
    try {
      const result = await formatAsync(tab.type, source, options, unescape);
      applyFormat(tab.id, result, true);
      if (result.error) toast('error', result.error.message);
    } catch (err) {
      updateTab(tab.id, { isFormatting: false });
      toast('error', err instanceof Error ? err.message : 'Format failed');
    }
  };

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    runFormatRef.current = runFormat;
  });

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast('success', `${label} copied`);
  };

  const download = (text: string) => {
    const ext = tab.type === 'xml' ? 'xml' : tab.type === 'json' ? 'json' : 'txt';
    const blob = new Blob([text], {
      type:
        tab.type === 'xml'
          ? 'application/xml'
          : tab.type === 'json'
            ? 'application/json'
            : 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab.name.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', `Downloaded .${ext}`);
  };

  const selected = findNodeById(tab.tree, tab.selectedNodeId ?? '');

  useEffect(() => {
    if (tab.editorView !== 'formatted' || !selected) return;
    const view = cmRef.current?.view;
    if (!view) return;
    const len = view.state.doc.length;
    if (len === 0) return;
    const anchor = Math.max(0, Math.min(selected.start, len));
    const head = Math.max(0, Math.min(selected.end, len));
    try {
      view.dispatch({
        selection: { anchor, head },
        scrollIntoView: true,
      });
    } catch {
      /* ignore out-of-range selection */
    }
  }, [selected, tab.editorView, tab.selectedNodeId]);

  /* CodeMirror listeners run after render; refs keep them from rebuilding the editor. */
  /* eslint-disable react-hooks/refs */
  const extensions = useMemo(() => {
    const extra: Extension[] = [];
    if (settings.wordWrap) extra.push(EditorView.lineWrapping);
    extra.push(
      EditorView.theme({
        '&': { fontSize: `${settings.fontSize}px`, height: '100%' },
        '.cm-scroller': {
          fontFamily:
            "Cascadia Code, Consolas, 'SF Mono', Menlo, ui-monospace, monospace",
        },
        '.cm-editor': { height: '100%' },
      }),
    );
    extra.push(
      EditorView.domEventHandlers({
        paste: (event) => {
          if (!settings.autoFormatOnPaste) return false;
          const text = event.clipboardData?.getData('text/plain');
          if (!text) return false;
          event.preventDefault();
          const current = tabRef.current;
          updateTab(current.id, { raw: text, editorView: 'input' });
          void runFormatRef.current(false, text);
          return true;
        },
      }),
    );
    extra.push(
      placeholder(
        tab.type === 'xml'
          ? 'Paste XML here…'
          : tab.type === 'json'
            ? 'Paste JSON here…'
            : 'Paste one value per line…',
      ),
    );
    extra.push(
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet) return;
        const current = tabRef.current;
        if (current.editorView !== 'formatted' || !current.tree) return;
        const pos = update.state.selection.main.head;
        const node = findNodeByOffset(current.tree, pos);
        if (node && node.id !== current.selectedNodeId) {
          updateTab(current.id, { selectedNodeId: node.id, cursorOffset: pos });
        }
      }),
    );
    return extra;
  }, [
    settings.wordWrap,
    settings.fontSize,
    settings.autoFormatOnPaste,
    tab.type,
    updateTab,
  ]);
  /* eslint-enable react-hooks/refs */

  const goToError = () => {
    if (!tab.error) return;
    updateTab(tab.id, { editorView: tab.usedLenient ? 'formatted' : 'input' });
    requestAnimationFrame(() => {
      const view = cmRef.current?.view;
      if (!view || tab.error?.index == null) return;
      view.dispatch({
        selection: { anchor: tab.error.index },
        scrollIntoView: true,
      });
    });
  };

  return (
    <div className="editor-panel">
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Editor view">
          <button
            type="button"
            className={tab.editorView === 'input' ? 'on' : ''}
            onClick={() => updateTab(tab.id, { editorView: 'input' })}
          >
            Input
          </button>
          <button
            type="button"
            className={tab.editorView === 'formatted' ? 'on' : ''}
            onClick={() => updateTab(tab.id, { editorView: 'formatted' })}
          >
            Formatted
          </button>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => void runFormat(false)}>
            Format
          </button>
          <button
            type="button"
            onClick={() => {
              const text =
                tab.minified ||
                (tab.type === 'json'
                  ? tab.formatted.replace(/\s+/g, '')
                  : tab.type === 'list'
                    ? tab.formatted.replace(/\s+/g, '')
                    : tab.formatted.replace(/>\s+</g, '><'));
              updateTab(tab.id, {
                formatted: text,
                editorView: 'formatted',
              });
              toast('success', 'Minified');
            }}
          >
            Minify
          </button>
          <button
            type="button"
            onClick={() =>
              void copy(
                tab.formatted || tab.raw,
                'Formatted',
              )
            }
          >
            Copy formatted
          </button>
          {(tab.type === 'xml' || tab.type === 'list') && (
            <button
              type="button"
              onClick={() => void copy(tab.minified || tab.raw, 'Minified')}
            >
              Copy minified
            </button>
          )}
          {tab.type === 'json' && (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const result = await formatAsync(tab.type, tab.raw || tab.formatted, {
                    ...options,
                    sortKeys: true,
                  });
                  applyFormat(tab.id, result);
                  toast('success', 'Sorted keys');
                })();
              }}
            >
              Sort keys
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              download(tab.formatted || tab.raw)
            }
          >
            Download
          </button>
          <button
            type="button"
            onClick={() =>
              updateTab(tab.id, {
                raw: '',
                formatted: '',
                minified: '',
                tree: null,
                error: null,
                notices: [],
                canUnescape: false,
                editorView: 'input',
              })
            }
          >
            Clear
          </button>
        </div>
      </div>
      <ErrorBar
        error={tab.error}
        notices={tab.notices}
        canUnescape={tab.canUnescape}
        usedLenient={tab.usedLenient}
        onUnescape={() => void runFormat(true)}
        onGotoError={goToError}
      />
      <div className="editor-host">
        {tab.isFormatting && (
          <div className="loading" role="status">
            Formatting…
          </div>
        )}
        <Suspense fallback={<div className="loading">Loading editor…</div>}>
          <CodeEditor
            ref={cmRef}
            value={value}
            dark={settings.theme === 'dark'}
            language={tab.type}
            extensions={extensions}
            onChange={(next) => {
              if (tab.editorView === 'input') updateTab(tab.id, { raw: next });
              else updateTab(tab.id, { formatted: next, raw: next });
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
