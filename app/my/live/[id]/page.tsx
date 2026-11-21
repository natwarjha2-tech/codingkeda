"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, MessageSquare, PhoneOff, Video, VideoOff } from "lucide-react";
import { api, ApiError } from "../../api";
import { useMy } from "../../MyContext";

/**
 * Student live room — the website version of the desktop live-room.js.
 * Uses the same vendored Amazon Chime SDK (window.ChimeSDK) and the same
 * backend (POST /join, /leave, chat GET/POST + Chime data messages, host
 * moderation topic). Joins muted with the camera off, like the desktop.
 */
const CHAT_TOPIC = "ck-live-chat";
const REACT_TOPIC = "ck-live-react";
const MOD_TOPIC = "ck-live-mod";
const REC_TOPIC = "ck-live-rec";
const REACTIONS = ["👍", "👏", "😂", "😮", "❤️", "🎉"];

type ChatMsg = { id: string; senderId: string; senderRole: string; senderName: string; message: string; createdAt: string };
type Tile = { tileId: number; isLocal: boolean; isContent: boolean; userId: string };
type Conn = "connecting" | "connected" | "reconnecting" | "poor" | "failed" | "ended";

let chimeLoader: Promise<any> | null = null;
function loadChime(): Promise<any> {
  const w = window as any;
  if (w.ChimeSDK) return Promise.resolve(w.ChimeSDK);
  if (!chimeLoader) {
    chimeLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/chime-sdk.min.js";
      s.async = true;
      s.onload = () => (w.ChimeSDK ? resolve(w.ChimeSDK) : reject(new Error("Chime SDK missing")));
      s.onerror = () => { chimeLoader = null; reject(new Error("Could not load the live class engine.")); };
      document.head.appendChild(s);
    });
  }
  return chimeLoader;
}

export default function LiveRoomPage() {
  const { id: classId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useMy();
  const myId = user?.id || "";

  const [title, setTitle] = useState("Live Class");
  const [hostId, setHostId] = useState("");
  const [conn, setConn] = useState<Conn>("connecting");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [muted, setMuted] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [micLocked, setMicLocked] = useState(false);
  const [camLocked, setCamLocked] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [floats, setFloats] = useState<{ id: number; e: string; x: number }[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const av = useRef<any>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const videoEls = useRef(new Map<number, HTMLVideoElement>());
  const leaving = useRef(false);
  const startedAt = useRef(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const names = useRef(new Map<string, string>());

  const addMsg = useCallback((m: ChatMsg) => {
    if (m.senderId && m.senderName) names.current.set(m.senderId, m.senderName);
    setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
  }, []);
  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(""), 6000); };
  const floatReaction = (e: string) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, e, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 3000);
  };

  const teardown = useCallback(async () => {
    const a = av.current;
    av.current = null;
    if (!a) return;
    try { a.stopLocalVideoTile(); } catch { /* ignore */ }
    try { await a.stopVideoInput(); } catch { /* ignore */ }
    try { await a.stopAudioInput(); } catch { /* ignore */ }
    try { a.stop(); } catch { /* ignore */ }
  }, []);

  const leave = useCallback(async (to = "/my/live") => {
    if (leaving.current) return;
    leaving.current = true;
    await teardown();
    api(`/api/live/classes/${encodeURIComponent(classId)}/leave`, { method: "POST", json: {} }).catch(() => {});
    router.push(to);
  }, [classId, router, teardown]);

  /* ── connect ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data: any;
      try {
        data = await api(`/api/live/classes/${encodeURIComponent(classId)}/join`, { method: "POST", json: { clientType: "STUDENT_WEB" } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 403 && window.confirm("The host removed you from this class. Ask the host to let you back in?")) {
          api(`/api/live/classes/${encodeURIComponent(classId)}/rejoin-request`, { method: "POST", json: {} }).catch(() => {});
          setErr("⏳ Request sent. Please wait for the host to approve, then join again.");
        } else setErr(e instanceof Error ? e.message : "Could not join the class.");
        return;
      }
      if (cancelled) return;
      setTitle(data.liveClass?.title || "Live Class");
      setHostId(data.liveClass?.hostUserId || "");

      let S: any;
      try { S = await loadChime(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load the live class engine."); return; }
      if (cancelled) return;

      const logger = new S.ConsoleLogger("CK-Live-Web", S.LogLevel ? S.LogLevel.WARN : 30);
      const dc = new S.DefaultDeviceController(logger);
      const session = new S.DefaultMeetingSession(new S.MeetingSessionConfiguration(data.meeting, data.attendee), logger, dc);
      const a = session.audioVideo;
      av.current = a;

      try {
        const mics = await a.listAudioInputDevices();
        if (mics?.[0]) await a.startAudioInput(mics[0].deviceId);
        else flash("No microphone found — you have joined in listen-only mode.");
      } catch {
        flash("Microphone is blocked or busy. You have joined in listen-only mode. Allow the microphone in your browser to speak.");
      }
      if (audioEl.current) { try { await a.bindAudioElement(audioEl.current); } catch { /* ignore */ } }

      a.addObserver({
        audioVideoDidStartConnecting: (re: boolean) => setConn(re ? "reconnecting" : "connecting"),
        audioVideoDidStart: () => {
          setConn("connected");
          if (!startedAt.current) startedAt.current = Date.now();
          try { a.realtimeMuteLocalAudio(); } catch { /* ignore */ }
          setMuted(true);
        },
        audioVideoDidStop: (status: any) => {
          let code = -1;
          try { code = status.statusCode(); } catch { /* ignore */ }
          if (leaving.current) return;
          if (code === 1) setConn("ended");
          else if (code !== 0) { setConn("failed"); flash("Connection lost. Trying to reconnect…"); }
        },
        connectionDidBecomePoor: () => setConn((c) => (c === "connected" ? "poor" : c)),
        videoTileDidUpdate: (t: any) => {
          if (!t?.boundAttendeeId) return;
          const uid = t.localTile ? myId : String(t.boundExternalUserId || "").split("#")[0];
          setTiles((list) => {
            const next = list.filter((x) => x.tileId !== t.tileId);
            next.push({ tileId: t.tileId, isLocal: !!t.localTile, isContent: !!t.isContent, userId: uid });
            return next;
          });
        },
        videoTileWasRemoved: (tileId: number) => setTiles((list) => list.filter((x) => x.tileId !== tileId)),
      });

      // Real-time chat, reactions, recording indicator, host moderation.
      try {
        a.realtimeSubscribeToReceiveDataMessage(CHAT_TOPIC, (dm: any) => { try { const m = JSON.parse(dm.text()); if (m?.id) addMsg(m); } catch { /* ignore */ } });
        a.realtimeSubscribeToReceiveDataMessage(REACT_TOPIC, (dm: any) => { try { const r = JSON.parse(dm.text()); if (r?.reaction) floatReaction(r.reaction); } catch { /* ignore */ } });
        a.realtimeSubscribeToReceiveDataMessage(REC_TOPIC, (dm: any) => { try { setRecording(!!JSON.parse(dm.text()).recording); } catch { /* ignore */ } });
        a.realtimeSubscribeToReceiveDataMessage(MOD_TOPIC, (dm: any) => {
          let p: any; try { p = JSON.parse(dm.text()); } catch { return; }
          if (!p) return;
          if (p.action === "removed" && p.targetUserId === myId) { window.alert("The host has removed you from this class."); leave(); return; }
          if (!p.type || (p.scope !== "all" && p.targetUserId !== myId)) return;
          const on = !!p.blocked;
          if (p.type === "audio") { setMicLocked(on); if (on) { try { a.realtimeMuteLocalAudio(); } catch { /* ignore */ } setMuted(true); flash("🔇 The host has muted you."); } }
          if (p.type === "video") { setCamLocked(on); if (on) { try { a.stopLocalVideoTile(); a.stopVideoInput(); } catch { /* ignore */ } setCamOn(false); flash("📷 The host turned off your camera."); } }
          if (p.type === "chat") setChatLocked(on);
        });
      } catch { /* ignore */ }

      a.start();
    })();
    // chat history
    api(`/api/live/classes/${encodeURIComponent(classId)}/chat`).then((d) => (d.messages || []).forEach(addMsg)).catch(() => {});

    return () => { cancelled = true; teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // bind video tiles to their <video> elements
  useEffect(() => {
    const a = av.current;
    if (!a) return;
    tiles.forEach((t) => { const el = videoEls.current.get(t.tileId); if (el) { try { a.bindVideoElement(t.tileId, el); } catch { /* ignore */ } } });
  }, [tiles]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);
  useEffect(() => {
    const t = setInterval(() => { if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, []);
  // Leaving the page without the button still tells the server.
  useEffect(() => {
    const h = () => {
      if (leaving.current) return;
      const token = localStorage.getItem("token");
      fetch(`/api/live/classes/${encodeURIComponent(classId)}/leave`, {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: "{}",
      }).catch(() => {});
    };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [classId]);

  const toggleMic = () => {
    const a = av.current; if (!a) return;
    if (micLocked && muted) { window.alert("⚠️ The host has muted you. You can speak once the host unmutes you."); return; }
    if (muted) { a.realtimeUnmuteLocalAudio(); setMuted(false); } else { a.realtimeMuteLocalAudio(); setMuted(true); }
  };
  const toggleCam = async () => {
    const a = av.current; if (!a) return;
    if (camLocked && !camOn) { window.alert("⚠️ The host has turned off your camera for this class."); return; }
    if (camOn) { try { a.stopLocalVideoTile(); await a.stopVideoInput(); } catch { /* ignore */ } setCamOn(false); return; }
    try {
      const cams = await a.listVideoInputDevices();
      if (!cams?.[0]) { flash("No camera was found on this computer."); return; }
      await a.startVideoInput(cams[0].deviceId);
      a.startLocalVideoTile();
      setCamOn(true);
    } catch { flash("Camera is blocked or busy. Allow the camera in your browser settings."); }
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (chatLocked) { flash("The host has turned off chat for now."); return; }
    setText("");
    try {
      const d = await api(`/api/live/classes/${encodeURIComponent(classId)}/chat`, { method: "POST", json: { message: t } });
      if (d.message) { addMsg(d.message); try { av.current?.realtimeSendDataMessage(CHAT_TOPIC, JSON.stringify(d.message)); } catch { /* ignore */ } }
    } catch (e) { setText(t); flash(e instanceof Error ? e.message : "Message not sent — try again."); }
  };
  const react = (e: string) => {
    floatReaction(e);
    try { av.current?.realtimeSendDataMessage(REACT_TOPIC, JSON.stringify({ reaction: e })); } catch { /* ignore */ }
    api(`/api/live/classes/${encodeURIComponent(classId)}/reactions`, { method: "POST", json: { reaction: e } }).catch(() => {});
  };

  const nameOf = (t: Tile) => (t.isLocal ? "You" : t.userId === hostId ? "👩‍🏫 Teacher" : names.current.get(t.userId) || "Classmate");
  const share = tiles.find((t) => t.isContent);
  const cams = tiles.filter((t) => !t.isContent).sort((a, b) => Number(b.userId === hostId) - Number(a.userId === hostId));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const connLabel: Record<Conn, [string, string]> = {
    connecting: ["Connecting…", "text-amber-300"], connected: ["● Live", "text-red-400"], reconnecting: ["Reconnecting…", "text-amber-300"],
    poor: ["● Live (weak connection)", "text-amber-300"], failed: ["Connection lost", "text-red-400"], ended: ["Class ended", "text-slate-400"],
  };

  if (err) {
    return <div className="mx-auto max-w-lg pt-16 text-center"><div className="text-5xl">📡</div><p className="mt-3 text-slate-300">{err}</p><Link href="/my/live" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Back to Live Classes</Link></div>;
  }

  const videoBox = (t: Tile, big = false) => (
    <div key={t.tileId} className={`relative overflow-hidden rounded-xl bg-black ${big ? "h-full w-full" : "aspect-video"} ${t.userId === hostId && !t.isContent ? "ring-2 ring-violet-400" : ""}`}>
      <video ref={(el) => { if (el) videoEls.current.set(t.tileId, el); else videoEls.current.delete(t.tileId); }} autoPlay playsInline muted={t.isLocal} className={`h-full w-full ${t.isContent ? "object-contain" : "object-cover"}`} />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-2 py-0.5 text-[11px] font-semibold">{t.isContent ? (t.userId === hostId ? "Teacher's screen" : "Presenter's screen") : nameOf(t)}</span>
    </div>
  );

  return (
    <div className="-mx-4 flex h-[calc(100vh-48px)] flex-col bg-[#07070d] md:-mx-6">
      <audio ref={audioEl} autoPlay className="hidden" />
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2">
        <b className="truncate">{title}</b>
        <span className={`text-xs font-bold ${connLabel[conn][1]}`}>{connLabel[conn][0]}</span>
        {startedAt.current > 0 && <span className="font-mono text-xs text-slate-400">{clock}</span>}
        {recording && <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-[11px] font-bold text-red-300">● Recording</span>}
        <div className="flex-1" />
        <button onClick={() => setChatOpen((o) => !o)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${chatOpen ? "bg-violet-600" : "bg-white/10"}`}><MessageSquare size={13} /> Chat</button>
      </div>
      {notice && <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">{notice}</div>}

      <div className="flex min-h-0 flex-1">
        {/* stage */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {share ? (
            <div className="flex min-h-0 flex-1 gap-3">
              <div className="min-w-0 flex-1">{videoBox(share, true)}</div>
              {cams.length > 0 && <div className="hidden w-48 shrink-0 flex-col gap-2 overflow-y-auto md:flex">{cams.map((t) => videoBox(t))}</div>}
            </div>
          ) : cams.length ? (
            <div className={`grid gap-3 ${cams.length === 1 ? "grid-cols-1" : cams.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>{cams.map((t) => videoBox(t))}</div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
              <div className="text-6xl">🎧</div>
              <p className="mt-2">{conn === "connected" || conn === "poor" ? "You're in! Listening to the class. Cameras will appear here when someone turns one on." : "Joining the class…"}</p>
            </div>
          )}
          {floats.map((f) => <span key={f.id} className="pointer-events-none absolute bottom-20 animate-bounce text-4xl" style={{ left: `${f.x}%` }}>{f.e}</span>)}

          {(conn === "ended" || conn === "failed") && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
              <div className="rounded-2xl border border-white/10 bg-[#16162a] p-8 text-center">
                <div className="text-5xl">{conn === "ended" ? "👋" : "📶"}</div>
                <h3 className="mt-2 text-xl font-extrabold">{conn === "ended" ? "The class has ended" : "Connection lost"}</h3>
                <p className="mt-1 text-sm text-slate-400">{conn === "ended" ? "Thanks for joining! The recording will appear in Recordings if your teacher recorded it." : "We couldn't reconnect. Check your internet and rejoin."}</p>
                <div className="mt-4 flex justify-center gap-2">
                  {conn === "failed" && <button onClick={() => window.location.reload()} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Rejoin</button>}
                  <button onClick={() => leave()} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold">Back to Live Classes</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* chat */}
        {chatOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#0e0e18]">
            <div className="border-b border-white/10 px-4 py-2.5 text-sm font-bold">💬 Class chat</div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {msgs.length === 0 && <div className="pt-6 text-center text-xs text-slate-500">No messages yet. Say hi! 👋</div>}
              {msgs.map((m) => {
                const mine = m.senderId === myId, teacher = m.senderRole === "teacher";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-violet-600/50" : teacher ? "border border-amber-400/30 bg-amber-400/10" : "bg-white/5"}`}>
                      {!mine && <div className="text-[10px] font-bold text-slate-400">{teacher ? `👩‍🏫 ${m.senderName}` : m.senderName}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.message}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEnd} />
            </div>
            <div className="flex gap-1 border-t border-white/10 px-3 py-2">{REACTIONS.map((e) => <button key={e} onClick={() => react(e)} className="rounded-lg px-1.5 py-1 text-lg hover:bg-white/10">{e}</button>)}</div>
            <div className="flex gap-2 p-3 pt-0">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} disabled={chatLocked}
                placeholder={chatLocked ? "Chat is turned off by the host" : "Type a message…"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-50" />
              <button onClick={send} disabled={chatLocked} className="rounded-xl bg-violet-600 px-3 text-sm font-bold disabled:opacity-50">Send</button>
            </div>
          </aside>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-3 border-t border-white/10 py-3">
        <button onClick={toggleMic} title={muted ? "Unmute" : "Mute"} className={`flex h-12 w-12 items-center justify-center rounded-full ${muted ? "bg-red-600" : "bg-white/15"} ${micLocked ? "opacity-60" : ""}`}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
        <button onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"} className={`flex h-12 w-12 items-center justify-center rounded-full ${camOn ? "bg-white/15" : "bg-red-600"} ${camLocked ? "opacity-60" : ""}`}>{camOn ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <button onClick={() => leave()} className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 font-bold hover:bg-red-500"><PhoneOff size={18} /> Leave</button>
      </div>
    </div>
  );
}
