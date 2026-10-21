import type { Extension } from '@codemirror/state';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { forwardRef, useEffect, useState } from 'react';
import type { TabType } from '../types';

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

    return (
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme={dark ? vscodeDark : vscodeLight}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          searchKeymap: true,
        }}
        extensions={[...extensions, ...langExt]}
        onChange={onChange}
      />
    );
  },
);
