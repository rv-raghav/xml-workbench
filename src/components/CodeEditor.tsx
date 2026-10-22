import type { Extension } from '@codemirror/state';
import { search } from '@codemirror/search';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TabType } from '../types';

const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  searchKeymap: true,
} as const;

const SEARCH_EXT = search({ top: true });

interface CodeEditorProps {
  value: string;
  dark: boolean;
  language: TabType;
  extensions: Extension[];
  onChange: (value: string) => void;
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(
  function CodeEditor({ value, dark, language, extensions, onChange }, ref) {
    const [langExt, setLangExt] = useState<Extension[]>([]);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const stableOnChange = useCallback((next: string) => {
      onChangeRef.current(next);
    }, []);

    useEffect(() => {
      let active = true;
      setLangExt([]);
      void (async () => {
        if (language === 'xml') {
          const { xml } = await import('@codemirror/lang-xml');
          if (active) setLangExt([xml()]);
          return;
        }
        if (language === 'json') {
          const { json } = await import('@codemirror/lang-json');
          if (active) setLangExt([json()]);
        }
      })();
      return () => {
        active = false;
      };
    }, [language]);

    const allExtensions = useMemo(
      () => [SEARCH_EXT, ...extensions, ...langExt],
      [extensions, langExt],
    );

    return (
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme={dark ? vscodeDark : vscodeLight}
        basicSetup={BASIC_SETUP}
        extensions={allExtensions}
        onChange={stableOnChange}
      />
    );
  },
);
