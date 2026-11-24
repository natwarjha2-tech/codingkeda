"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiCached } from "../api";
import { useMy } from "../MyContext";
import { Loading, PageHeader, fmtDateTime } from "@/components/my/ui";

type Offer = { id: string; title: string; description: string; coinsRequired: number; available: boolean };
type Disc = { id: string; percent: number; label?: string };
type Tx = { id: string; type: string; coins: number; reason?: string; createdAt: string; courseTitle?: string; moduleTitle?: string; lessonTitle?: string };

const accent = (o: Offer) => {
  const t = `${o.title} ${o.description}`.toLowerCase();
  if (t.includes("10%")) return { c: "#a78bfa", i: "🎫" };
  if (t.includes("25%") || t.includes("discount")) return { c: "#ec4899", i: "🏷️" };
  if (t.includes("free") || t.includes("access")) return { c: "#22c55e", i: "🎁" };
  if (t.includes("certificate") || t.includes("frame")) return { c: "#3b82f6", i: "🏅" };
  if (t.includes("doubt") || t.includes("session")) return { c: "#f59e0b", i: "👨‍🏫" };
  return { c: "#a78bfa", i: "🎁" };
};

export default function MallPage() {
  const { refreshCoins } = useMy();
  const [mall, setMall] = useState<{ balance: number; offers: Offer[] } | null>(null);
  const [discounts, setDiscounts] = useState<Disc[]>([]);
  const [spent, setSpent] = useState<Tx[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const hist = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    apiCached("/api/mall", (d) => setMall({ balance: d.balance || 0, offers: d.offers || [] })).catch(() => setMall({ balance: 0, offers: [] }));
    apiCached("/api/discount", (d) => setDiscounts(d.discounts || [])).catch(() => {});
    apiCached("/api/coins", (d) => setSpent((d.transactions || []).filter((t: Tx) => t.type === "SPENT"))).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const apply = async () => {
    if (!code.trim()) { setMsg({ ok: false, text: "Please enter a coupon code" }); return; }
    setBusy("coupon");
    try {
      const d = await api("/api/mall/redeem", { method: "POST", json: { couponCode: code.trim() } });
      setMsg({ ok: true, text: d.coupon ? `✅ ${d.message} — ${d.coupon.discount}% off!` : `✅ ${d.message}` });
      setCode(""); load(); refreshCoins();
    } catch (e) { setMsg({ ok: false, text: `❌ ${e instanceof Error ? e.message : "Network error"}` }); }
    finally { setBusy(""); }
  };

  const redeem = async (o: Offer) => {
    if (!window.confirm(`Redeem "${o.title}" for ${o.coinsRequired} coins?`)) return;
    setBusy(o.id);
    try {
      const d = await api("/api/mall/redeem", { method: "POST", json: { offerId: o.id } });
      window.alert(`✅ ${d.message}\nNew balance: ${d.newBalance} coins`);
      load(); refreshCoins();
    } catch (e) { window.alert(`❌ ${e instanceof Error ? e.message : "Network error"}`); }
    finally { setBusy(""); }
  };

  const header = <PageHeader icon="🏬" title="CodingKida Mall" sub="Turn your learning into rewards" />;
  if (!mall) return <div className="w-full pt-2">{header}<Loading text="Loading offers..." /></div>;

  return (
    <div className="w-full space-y-6 pt-2">
      {header}
      <section className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-r from-amber-500/15 to-orange-500/5 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/20 text-4xl">🪙</span>
          <div>
            <div className="text-sm text-amber-200/80">Your Coins</div>
            <div className="text-4xl font-extrabold text-amber-300">{mall.balance} <span className="text-lg">Coins</span></div>
            <div className="text-xs text-slate-400">Earn more coins by learning and completing activities.</div>
          </div>
        </div>
        <button onClick={() => hist.current?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5">📜 View History</button>
      </section>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-400/20 bg-[#161626]/75 p-5">
        <div className="flex min-w-[240px] flex-1 items-center gap-3">
          <span className="text-2xl">🎫</span>
          <div><div className="font-bold">Have a coupon or referral code?</div><div className="text-xs text-slate-400">Enter a coupon for a discount, or a friend&apos;s referral code to earn 50 coins.</div></div>
        </div>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="Enter coupon or referral code" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm uppercase outline-none focus:border-violet-400" />
          <button onClick={apply} disabled={busy === "coupon"} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold hover:bg-violet-500 disabled:opacity-60">Apply</button>
        </div>
        {msg && <div className={`basis-full text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</div>}
      </section>

      <div>
        <h2 className="text-xl font-extrabold">🎁 Redeem Rewards</h2>
        <p className="mb-3 text-sm text-slate-400">Turn your coins into useful learning rewards.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mall.offers.map((o) => {
            const a = accent(o);
            return (
              <div key={o.id} className={`flex flex-col rounded-2xl border bg-[#161626]/75 p-5 ${o.available ? "" : "opacity-60"}`} style={{ borderColor: `${a.c}35` }}>
                <div className="flex gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${a.c}18` }}>{a.i}</span>
                  <div><div className="font-bold">{o.title}</div><div className="text-xs text-slate-400">{o.description}</div></div>
                </div>
                <div className="my-4 h-px bg-white/10" />
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-extrabold text-amber-300">🪙 {o.coinsRequired} <span className="text-xs text-slate-400">Coins</span></span>
                  <button onClick={() => redeem(o)} disabled={!o.available || !!busy} className="rounded-xl px-4 py-2 text-sm font-bold disabled:cursor-not-allowed" style={{ background: o.available ? a.c : "rgba(255,255,255,0.08)", color: o.available ? "#0b0b14" : "#94a3b8" }}>
                    {o.available ? "Redeem →" : "🔒 Locked"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div ref={hist}>
        <h2 className="text-xl font-extrabold">📜 Redemption History</h2>
        <p className="mb-3 text-sm text-slate-400">Your redeemed rewards, discounts and coin activity.</p>
        {discounts.length === 0 && spent.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">No redemptions yet. Redeem a reward above to see it here.</div>
        ) : (
          <div className="space-y-2">
            {discounts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
                <span className="text-xl">🎫</span>
                <div className="flex-1"><div className="font-semibold">{d.label || `${d.percent}% Discount`}</div><div className="text-xs text-emerald-300">Ready to use at checkout</div></div>
                <span className="rounded-lg bg-emerald-400/15 px-2.5 py-1 text-sm font-extrabold text-emerald-400">{d.percent}% OFF</span>
              </div>
            ))}
            {spent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="text-xl">🎁</span>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{t.reason || "Coins redeemed"}</div><div className="truncate text-xs text-slate-500">{[t.courseTitle, t.moduleTitle, t.lessonTitle].filter(Boolean).join(" › ")}{t.courseTitle ? "  •  " : ""}{fmtDateTime(t.createdAt)}</div></div>
                <b className="text-red-400">-{t.coins}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
