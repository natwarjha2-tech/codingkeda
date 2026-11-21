"use client";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useMy } from "../MyContext";
import { PageHeader, Panel } from "@/components/my/ui";

type Ref = { code: string; referredCount: number; coinsEarned: number; rewardNewUser?: number; rewardReferrer?: number };

export default function ReferralPage() {
  const { user } = useMy();
  const [r, setR] = useState<Ref | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { api("/api/referral").then(setR).catch(() => {}); }, []);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 3000); };

  const copy = () => {
    if (!r?.code) { flash("Please wait — loading your code…"); return; }
    navigator.clipboard?.writeText(r.code).then(() => flash(`✅ Code ${r.code} copied!`)).catch(() => flash(r.code));
  };
  const shareUrl = () => {
    const msg = `🎓 Hey! ${user?.name || "My friend"} invited you to join CodingKida — India's best coding platform for kids!\n\n✅ Learn Java, Python, Web Dev & more\n🏆 Earn badges & certificates\n🤖 24/7 AI mentor\n\n👉 Use my referral code: *${r?.code}*\nDownload: https://www.codingkida.com/download`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };
  const newUser = r?.rewardNewUser ?? 50, referrer = r?.rewardReferrer ?? 50;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pt-2">
      <PageHeader icon="🎁" title="Refer & Earn" sub={`Invite friends and earn ${referrer} coins for every successful referral`} />
      <section className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/15 to-fuchsia-500/10 p-6 text-center">
        <div className="text-sm font-semibold text-amber-200/80">Your Referral Code</div>
        <div className="my-3 font-mono text-4xl font-extrabold tracking-[6px] text-amber-300">{r?.code || "------"}</div>
        <div className="mb-4 text-xs text-slate-400">Tap copy and share with friends</div>
        <div className="flex justify-center gap-3">
          <button onClick={copy} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold hover:bg-white/5">📋 Copy Code</button>
          {r?.code ? <a href={shareUrl()} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#052e16] hover:bg-emerald-400">💬 Share</a>
            : <button disabled className="rounded-xl bg-emerald-500/40 px-5 py-2.5 text-sm font-bold">💬 Share</button>}
        </div>
      </section>
      <Panel title="Referral Performance" icon="📈">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-4 text-center"><div className="text-3xl font-extrabold text-violet-300">{r?.referredCount ?? 0}</div><div className="text-xs text-slate-400">Friends Referred</div></div>
          <div className="rounded-xl bg-white/5 p-4 text-center"><div className="text-3xl font-extrabold text-amber-300">{r?.coinsEarned ?? 0}</div><div className="text-xs text-slate-400">Coins Earned</div></div>
        </div>
        <div className="mt-3 text-center text-xs text-slate-500">Earn {referrer} bonus coins whenever an invitee subscribes.</div>
      </Panel>
      <Panel title="How It Works" icon="💡">
        <ol className="space-y-3">
          {[
            ["Share Your Code", "Send your code to friends via WhatsApp or any app."],
            ["Friend Signs Up & Applies Code", "Your friend creates an account and enters your code in CK Mall under “Have a coupon?”."],
            [`Both Earn ${newUser} Coins`, `Your friend gets ${newUser} coins instantly. You earn ${referrer} when they buy their first course.`],
          ].map(([t, d], i) => (
            <li key={i} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-extrabold text-violet-200">{i + 1}</span><div><div className="font-bold">{t}</div><div className="text-sm text-slate-400">{d}</div></div></li>
          ))}
        </ol>
      </Panel>
      {toast && <div className="fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-[#1e1e2e] px-6 py-3 text-sm font-semibold text-amber-300 shadow-2xl">{toast}</div>}
    </div>
  );
}
