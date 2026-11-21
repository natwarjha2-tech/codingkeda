/**
 * Loads the Monaco editor (the VS Code editor) from the same CDN and version
 * the desktop app uses, on demand. No npm dependency.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MONACO_CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";

export const CODING_LANGUAGES = [
  { id: "java", label: "Java", monacoId: "java", judge0Id: 62, extension: ".java", icon: "☕" },
  { id: "c", label: "C", monacoId: "c", judge0Id: 50, extension: ".c", icon: "🇨" },
  { id: "python", label: "Python", monacoId: "python", judge0Id: 71, extension: ".py", icon: "🐍" },
  { id: "javascript", label: "JavaScript", monacoId: "javascript", judge0Id: 63, extension: ".js", icon: "🟨" },
] as const;
export type LangId = (typeof CODING_LANGUAGES)[number]["id"];
export const langOf = (id: string) => CODING_LANGUAGES.find((l) => l.id === id) || CODING_LANGUAGES[0];

export function getDefaultStarter(langId: string): string {
  const s: Record<string, string> = {
    c: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main() {\n    // Read input\n    \n    // Write your solution here\n    \n    return 0;\n}\n',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n        // Read input\n        \n        // Write your solution here\n        \n        sc.close();\n    }\n}\n',
    python: "# Read input\n\n# Write your solution here\n\n",
    javascript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nconst lines = [];\nrl.on("line", (line) => lines.push(line.trim()));\nrl.on("close", () => {\n    // Read input from lines[]\n    \n    // Write your solution here\n    \n});\n',
  };
  return s[langId] || "// Write your code here\n";
}

let loading: Promise<any> | null = null;

export function loadMonaco(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.monaco?.editor) return Promise.resolve(w.monaco);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    // Workers come from the CDN (another origin), so start them through a tiny same-origin data: script.
    w.MonacoEnvironment = {
      getWorkerUrl: () =>
        `data:text/javascript;charset=utf-8,${encodeURIComponent(
          `self.MonacoEnvironment={baseUrl:'${MONACO_CDN}/'};importScripts('${MONACO_CDN}/vs/base/worker/workerMain.js');`,
        )}`,
    };
    const s = document.createElement("script");
    s.src = `${MONACO_CDN}/vs/loader.js`;
    s.async = true;
    s.onload = () => {
      w.require.config({ paths: { vs: `${MONACO_CDN}/vs` } });
      w.require(["vs/editor/editor.main"], () => {
        const m = w.monaco;
        if (!w._ckMonacoThemes) {
          m.editor.defineTheme("ck-dark", {
            base: "vs-dark", inherit: true, rules: [],
            colors: { "editor.background": "#000000", "editorGutter.background": "#000000", "editorLineNumber.foreground": "#555555", "editorLineNumber.activeForeground": "#888888" },
          });
          m.editor.defineTheme("ck-light", { base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff" } });
          w._ckMonacoThemes = true;
        }
        resolve(m);
      }, (e: unknown) => { loading = null; reject(e); });
    };
    s.onerror = () => { loading = null; reject(new Error("Failed to load the code editor")); };
    document.head.appendChild(s);
  });
  return loading;
}
