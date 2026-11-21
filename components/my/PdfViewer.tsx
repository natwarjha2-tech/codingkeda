"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * In-page PPT/PDF viewer drawn on a <canvas> with PDF.js (same as the desktop
 * pdf-viewer.js) — no download/print toolbar, right-click blocked. If the file
 * can't be read in the page (e.g. storage CORS), it offers to open it in a tab.
 */
let pdfLoader: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  if (!pdfLoader) {
    pdfLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/pdf.min.js";
      s.onload = () => { if (w.pdfjsLib) { w.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js"; resolve(w.pdfjsLib); } else reject(new Error("pdf.js missing")); };
      s.onerror = () => { pdfLoader = null; reject(new Error("pdf.js failed to load")); };
      document.head.appendChild(s);
    });
  }
  return pdfLoader;
}

export default function PdfViewer({ url, title = "Study material", onClose }: { url: string; title?: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<any>(null);
  const task = useRef<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1.4);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let dead = false;
    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url, withCredentials: false }).promise)
      .then((pdf: any) => { if (dead) return; doc.current = pdf; setPages(pdf.numPages); setPage(1); setState("ready"); })
      .catch(() => !dead && setState("error"));
    return () => { dead = true; try { doc.current?.destroy?.(); } catch { /* ignore */ } doc.current = null; };
  }, [url]);

  const render = useCallback(async () => {
    const pdf = doc.current, c = canvas.current;
    if (!pdf || !c) return;
    try { task.current?.cancel?.(); } catch { /* ignore */ }
    const p = await pdf.getPage(page);
    const vp = p.getViewport({ scale });
    c.width = vp.width; c.height = vp.height;
    task.current = p.render({ canvasContext: c.getContext("2d"), viewport: vp });
    try { await task.current.promise; } catch { /* cancelled */ }
  }, [page, scale]);
  useEffect(() => { if (state === "ready") render(); }, [state, render]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPage((p) => Math.min(pages || p, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, pages]);

  const b = "rounded-md bg-white/10 px-2.5 py-1.5 hover:bg-white/20 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-[#1a1a2e]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#16213e] px-4 py-2.5">
          <b className="truncate text-sm">📄 {title}</b>
          <div className="flex items-center gap-2 text-sm">
            <button className={b} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
            <span className="text-xs text-slate-400">{state === "ready" ? `${page} / ${pages}` : "…"}</span>
            <button className={b} disabled={!pages || page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
            <button className={b} onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} aria-label="Zoom out"><ZoomOut size={14} /></button>
            <button className={b} onClick={() => setScale((s) => Math.min(3, s + 0.25))} aria-label="Zoom in"><ZoomIn size={14} /></button>
            <button onClick={onClose} className="rounded-md bg-red-500/20 px-2.5 py-1.5 text-red-300" aria-label="Close"><X size={14} /></button>
          </div>
        </div>
        <div className="flex flex-1 select-none justify-center overflow-auto bg-[#0f0f1a] p-5" onContextMenu={(e) => e.preventDefault()}>
          {state === "loading" && <div className="self-center text-slate-400">Loading…</div>}
          {state === "error" && (
            <div className="self-center text-center">
              <p className="text-slate-300">This file couldn&apos;t be shown inside the page.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Open in a new tab</a>
            </div>
          )}
          <canvas ref={canvas} className={`h-max rounded shadow-2xl ${state === "ready" ? "" : "hidden"}`} />
        </div>
      </div>
    </div>
  );
}
