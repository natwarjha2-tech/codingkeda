"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { langOf, loadMonaco } from "./monaco";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EditorHandle = {
  getValue: () => string;
  setValue: (v: string) => void;
  format: () => void;
  layout: () => void;
};

type Props = {
  value: string;           // initial value (re-applied when `resetKey` changes)
  resetKey: string;        // change this to load a new document (problem / language)
  language: string;        // CodingKida language id: java | c | python | javascript
  theme: "dark" | "light";
  onChange?: (v: string) => void;
  onCursor?: (line: number, col: number) => void;
  className?: string;
};

/** Monaco editor with the desktop app's options; falls back to a textarea if the CDN fails. */
const MonacoEditor = forwardRef<EditorHandle, Props>(function MonacoEditor(
  { value, resetKey, language, theme, onChange, onCursor, className },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const ed = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(value);
  const cb = useRef({ onChange, onCursor });
  cb.current = { onChange, onCursor };
  const latest = useRef({ value, language, theme });
  latest.current = { value, language, theme };

  useImperativeHandle(ref, () => ({
    getValue: () => (ed.current ? ed.current.getValue() : fallback),
    setValue: (v: string) => { if (ed.current) ed.current.setValue(v); else setFallback(v); },
    format: () => { ed.current?.getAction?.("editor.action.formatDocument")?.run(); },
    layout: () => ed.current?.layout(),
  }), [fallback]);

  // Create once.
  useEffect(() => {
    let disposed = false;
    loadMonaco()
      .then((monaco) => {
        if (disposed || !box.current) return;
        ed.current = monaco.editor.create(box.current, {
          value: latest.current.value,
          language: langOf(latest.current.language).monacoId,
          theme: latest.current.theme === "light" ? "ck-light" : "ck-dark",
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          lineNumbers: "on",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          tabSize: 4,
          wordWrap: "on",
          bracketPairColorization: { enabled: true },
          renderLineHighlight: "line",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          quickSuggestions: false,
        });
        ed.current.onDidChangeModelContent(() => cb.current.onChange?.(ed.current.getValue()));
        ed.current.onDidChangeCursorPosition((e: any) => cb.current.onCursor?.(e.position.lineNumber, e.position.column));
        setReady(true);
      })
      .catch(() => !disposed && setFailed(true));
    return () => { disposed = true; ed.current?.dispose(); ed.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New document (problem or language changed).
  useEffect(() => {
    const e = ed.current;
    const w = window as any;
    if (e && w.monaco) {
      w.monaco.editor.setModelLanguage(e.getModel(), langOf(language).monacoId);
      if (e.getValue() !== value) e.setValue(value);
    } else {
      setFallback(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const w = window as any;
    if (ed.current && w.monaco) w.monaco.editor.setTheme(theme === "light" ? "ck-light" : "ck-dark");
  }, [theme]);

  if (failed) {
    return (
      <textarea
        value={fallback}
        onChange={(e) => { setFallback(e.target.value); onChange?.(e.target.value); }}
        spellCheck={false}
        placeholder="// Write your code here..."
        className={`h-full w-full resize-none bg-black p-3 font-mono text-sm text-violet-100 outline-none ${className || ""}`}
      />
    );
  }
  return (
    <div className={`relative h-full w-full ${className || ""}`}>
      {/* Monaco owns this div's children; React never renders into it. */}
      <div ref={box} className="absolute inset-0" />
      {!ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-sm text-white/50">Loading editor…</div>}
    </div>
  );
});

export default MonacoEditor;
