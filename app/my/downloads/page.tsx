"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, CloudDownload, Compass, Eye, FileText, PlayCircle, Search, Trash2, X } from "lucide-react";
import { useMy } from "../MyContext";
import { subjectLogo, subjectTheme } from "../ui";
import { EXPIRY_DAYS, deleteOffline, formatBytes, listOffline, openOffline, type OfflineListItem } from "../offline";
import HlsPlayer from "@/components/learn/HlsPlayer";
import PdfViewer from "@/components/my/PdfViewer";

type Viewer = { type: "hls" | "pdf"; url: string; title: string; lessonId: string; revoke: () => void };

/** Downloads — offline lessons & study material saved in this browser (desktop app layout). */
export default function DownloadsPage() {
  const { user } = useMy();
  const uid = user?.id || "";
  const [items, setItems] = useState<OfflineListItem[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [closedCourses, setClosedCourses] = useState<Record<string, boolean>>({});
  const [openMods, setOpenMods] = useState<Record<string, boolean>>({});
  const [closedSubs, setClosedSubs] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  const load = useCallback(() => {
    if (!uid) return;
    listOffline(uid).then(setItems).catch((e) => { setErr(e instanceof Error ? e.message : "Couldn't read downloads."); setItems([]); });
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage || 0, quota: e.quota || 0 })).catch(() => {});
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!items) return [];
    return s ? items.filter((d) => [d.title, d.courseTitle, d.moduleTitle].some((x) => (x || "").toLowerCase().includes(s))) : items;
  }, [items, q]);

  // course → module → items (same grouping as the desktop app)
  const grouped = useMemo(() => {
    const g = new Map<string, Map<string, OfflineListItem[]>>();
    filtered.forEach((d) => {
      const c = d.courseTitle || "Uncategorized", m = d.moduleTitle || "General";
      if (!g.has(c)) g.set(c, new Map());
      const mm = g.get(c)!;
      if (!mm.has(m)) mm.set(m, []);
      mm.get(m)!.push(d);
    });
    return [...g.entries()];
  }, [filtered]);

  const watch = async (d: OfflineListItem) => {
    try {
      const o = await openOffline(d.key);
      setViewer({ type: o.type, url: o.url, title: d.title, lessonId: d.lessonId, revoke: o.revoke });
    } catch (e) { alert(e instanceof Error ? e.message : "Couldn't open this download."); load(); }
  };
  const close = () => { viewer?.revoke(); setViewer(null); };
  const remove = async (d: OfflineListItem) => {
    if (!confirm(`Remove "${d.title}" from downloads?`)) return;
    await deleteOffline(d.key).catch(() => {});
    load();
  };

  const totalSize = (items || []).reduce((s, d) => s + (d.fileSize || 0), 0);

  return (
    <div className="pt-2">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-violet-400/25 bg-violet-500/10 text-violet-300"><CloudDownload size={18} /></div>
          <div>
            <h1 className="text-[1.3rem] font-black">Downloads</h1>
            <p className="text-xs text-slate-400">Watch your saved lessons even without internet · kept for {EXPIRY_DAYS} days</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items && items.length > 0 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
              {items.length} item{items.length !== 1 ? "s" : ""} · {formatBytes(totalSize) || "0 B"}
              {usage?.quota ? <span className="text-slate-500"> · {formatBytes(Math.max(0, usage.quota - usage.used))} free</span> : null}
            </span>
          )}
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search downloads..."
              className="w-52 rounded-lg border border-white/10 bg-white/[0.03] py-[7px] pl-7 pr-2.5 text-[0.78rem] outline-none focus:border-violet-400/40" />
          </div>
        </div>
      </div>

      {err && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>}

      {!items ? (
        <div className="py-10 text-center text-sm text-slate-400">⏳ Loading downloads...</div>
      ) : items.length === 0 ? (
        <Empty />
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Search size={34} className="mx-auto mb-4 text-violet-400/30" />
          <h3 className="mb-2 text-[1.05rem] font-extrabold">No downloads match &quot;{q}&quot;</h3>
          <p className="text-sm text-slate-400">Try a different search term.</p>
        </div>
      ) : (
        <div className="space-y-[18px]">
          {grouped.map(([course, mods], ci) => {
            const count = [...mods.values()].reduce((s, l) => s + l.length, 0);
            const open = !(closedCourses[course] ?? ci !== 0);
            const logo = subjectLogo(course);
            return (
              <div key={course} className="overflow-hidden rounded-[14px] border border-violet-400/10 bg-[rgba(15,15,35,0.4)]">
                <button onClick={() => setClosedCourses((s) => ({ ...s, [course]: open }))} className="flex w-full items-center gap-3.5 px-[18px] py-3.5 text-left transition hover:bg-violet-500/[0.04]">
                  {logo
                    ? <img src={logo} alt="" draggable={false} className="h-9 w-9 shrink-0 rounded-[9px] border border-violet-400/20 bg-violet-500/[0.08] object-contain p-[3px]" />
                    : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-sm font-black" style={{ background: subjectTheme(course).gradient }}>{course.charAt(0)}</span>}
                  <span className="flex-1">
                    <span className="block text-[0.9rem] font-extrabold">{course}</span>
                    <span className="text-[0.68rem] text-slate-400">{count} downloaded item{count > 1 ? "s" : ""}</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>

                {open && (
                  <div className="space-y-3 px-3.5 pb-3.5">
                    {[...mods.entries()].map(([module, list], mi) => {
                      const mk = `${course}::${module}`;
                      const modOpen = openMods[mk] ?? mi === 0; // first module open by default (desktop)
                      const videos = list.filter((d) => d.type === "hls");
                      const pdfs = list.filter((d) => d.type === "pdf");
                      return (
                        <div key={module} className="w-full overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
                          <button onClick={() => setOpenMods((s) => ({ ...s, [mk]: !modOpen }))} className="flex w-full items-center justify-between px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                            <span className="flex items-center gap-2.5">
                              <span className="h-[18px] w-1 shrink-0 rounded bg-gradient-to-b from-[#6c47ff] to-[#a855f7]" />
                              <span className="text-[0.9rem] font-bold">{module}</span>
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.7rem] text-slate-400">{list.length} items</span>
                            </span>
                            <ChevronDown size={12} className={`text-slate-500 transition-transform ${modOpen ? "" : "-rotate-90"}`} />
                          </button>
                          {modOpen && (
                            <div className="px-2 pb-2">
                              {videos.length > 0 && (
                                <Sub id={`${mk}::v`} icon={<PlayCircle size={12} />} label="Lesson Videos" n={videos.length} closed={!!closedSubs[`${mk}::v`]} toggle={(k) => setClosedSubs((s) => ({ ...s, [k]: !s[k] }))}>
                                  {videos.map((d) => <Row key={d.key} d={d} onOpen={() => watch(d)} onRemove={() => remove(d)} />)}
                                </Sub>
                              )}
                              {pdfs.length > 0 && (
                                <Sub id={`${mk}::p`} icon={<BookOpen size={12} />} label="Study Material" n={pdfs.length} closed={!!closedSubs[`${mk}::p`]} toggle={(k) => setClosedSubs((s) => ({ ...s, [k]: !s[k] }))} border={videos.length > 0}>
                                  {pdfs.map((d) => <Row key={d.key} d={d} onOpen={() => watch(d)} onRemove={() => remove(d)} />)}
                                </Sub>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <p className="pt-1 text-center text-[11px] text-slate-500">Downloads are saved privately in this browser on this device. Clearing browser data removes them.</p>
        </div>
      )}

      {/* Offline video player */}
      {viewer?.type === "hls" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={close}>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0"><div className="truncate font-extrabold">{viewer.title}</div><div className="text-xs text-emerald-400">● Playing offline</div></div>
              <button onClick={close} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              <HlsPlayer lessonId={viewer.lessonId} src={viewer.url} autoPlay onFail={() => { alert("This download couldn't be played. Please remove it and download again."); close(); }} />
            </div>
          </div>
        </div>
      )}
      {viewer?.type === "pdf" && <PdfViewer url={viewer.url} title={viewer.title} onClose={close} />}
    </div>
  );
}

function Sub({ id, icon, label, n, closed, toggle, border, children }: { id: string; icon: React.ReactNode; label: string; n: number; closed: boolean; toggle: (k: string) => void; border?: boolean; children: React.ReactNode }) {
  return (
    <div className={border ? "mt-0.5 border-t border-white/[0.04]" : ""}>
      <button onClick={() => toggle(id)} className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left">
        <ChevronDown size={10} className={`w-2.5 text-slate-500 transition-transform ${closed ? "-rotate-90" : ""}`} />
        <span className="text-violet-400">{icon}</span>
        <span className="text-[0.72rem] font-bold uppercase tracking-wide text-violet-400">{label}</span>
        <span className="ml-auto text-[0.62rem] text-slate-500">{n}</span>
      </button>
      {!closed && <div className="space-y-2 px-1 pt-1">{children}</div>}
    </div>
  );
}

function Row({ d, onOpen, onRemove }: { d: OfflineListItem; onOpen: () => void; onRemove: () => void }) {
  const video = d.type === "hls";
  const chip = "inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[0.7rem] font-bold leading-none";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition hover:-translate-y-px hover:border-violet-400/20 hover:bg-violet-500/[0.04] hover:shadow-lg max-sm:flex-col max-sm:items-start">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border bg-white/[0.03] ${video ? "border-emerald-500/20 text-emerald-500" : "border-red-500/20 text-red-500"}`}>
          {video ? <PlayCircle size={16} /> : <FileText size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="mb-1.5 block truncate text-[0.9rem] font-bold">{d.title}</span>
          <span className="flex flex-wrap items-center gap-[7px]">
            <span className={`${chip} border border-violet-400/25 bg-violet-500/15 text-violet-200`}>{video ? "HLS Video" : "PDF · Study Material"}</span>
            {formatBytes(d.fileSize) && <span className={`${chip} border border-white/10 bg-white/[0.06] text-white/80`}>💾 {formatBytes(d.fileSize)}</span>}
            <span className={`${chip} border border-amber-400/25 bg-amber-400/10 text-amber-300`}>⏱ {d.daysLeft} day{d.daysLeft !== 1 ? "s" : ""} left</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-br from-[#6c47ff] to-[#a855f7] px-4 py-2 text-[0.74rem] font-bold transition hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(108,71,255,0.3)]">
          {video ? <><PlayCircle size={12} /> Watch</> : <><Eye size={12} /> View</>}
        </button>
        <button onClick={onRemove} title="Remove" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-white/[0.08] text-white/30 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-5 py-20 text-center">
      <CloudDownload size={44} className="mx-auto mb-4 text-violet-400/25" />
      <h3 className="mb-2 text-[1.05rem] font-extrabold">No Offline Lessons Yet</h3>
      <p className="mx-auto mb-5 max-w-xs text-[0.8rem] leading-relaxed text-slate-400">Download lessons to keep learning even without an internet connection. Tap <b className="text-white">Download Lesson</b> under any video.</p>
      <Link href="/my/courses" className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-[#6c47ff] to-[#a855f7] px-5 py-2.5 text-[0.8rem] font-bold transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(108,71,255,0.3)]">
        <Compass size={14} /> Explore Courses
      </Link>
    </div>
  );
}
