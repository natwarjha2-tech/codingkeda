"use client";
import { useEffect, useState } from "react";
import { apiCached } from "../api";
import { PageHeader, Panel } from "@/components/my/ui";

const FAQS = [
  { q: "How do I enroll in a course?", a: "Go to Courses, open any course and tap “Unlock full course”." },
  { q: "How do I earn coins?", a: "Complete quizzes and rank in the top 10, solve coding problems and weekly challenges to earn coins automatically." },
  { q: "Can I download lessons for offline use?", a: "Offline downloads are available in the CodingKida mobile and desktop apps. On the website, lessons stream online." },
  { q: "How do I track my progress?", a: "Open My Report or Student Progress from your Profile to see your full learning progress." },
  { q: "What are achievements?", a: "Complete quizzes and rank #1–10 to earn Super Master, Master, or Pro badges." },
];

const pretty = (d: string) => (d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`);

export default function HelpPage() {
  const [wa, setWa] = useState("");
  const [email, setEmail] = useState("support@codingkida.com");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    apiCached("/api/app-config", (d) => {
      const n = String(d.supportWhatsapp || "").replace(/[^0-9]/g, "");
      if (n.length >= 6) setWa(n);
      if (/.+@.+\..+/.test(d.supportEmail || "")) setEmail(d.supportEmail);
    }).catch(() => {});
  }, []);

  const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Hi CodingKida Support! I need help with the website.")}` : "";
  const mailUrl = `mailto:${email}?subject=${encodeURIComponent("Help Request")}&body=${encodeURIComponent("Hi CodingKida Support,\n\nI need help with:\n\n[Describe your issue here]\n\nThank you")}`;

  return (
    <div className="w-full space-y-5 pt-2">
      <PageHeader icon="💖" title="24/7 Help & Support" sub="We're always here for you — anytime, anywhere"
        right={<span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> We&apos;re here</span>} />
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Chat with Support Team" icon="💬" sub="Get help from our experts">
          <p className="mb-4 text-sm text-slate-400">Need help with courses, payments, or technical issues? Our support team is ready to assist you on WhatsApp.</p>
          {waUrl ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-3 text-center font-bold text-emerald-400 hover:bg-emerald-400/20">💬 Chat with Us</a>
            : <a href={mailUrl} className="block rounded-xl border border-violet-400/30 bg-violet-500/10 py-3 text-center font-bold text-violet-300">✉️ Email Us</a>}
          {wa && <div className="mt-2 text-center text-xs text-slate-500">WhatsApp: <b className="text-emerald-400">{pretty(wa)}</b></div>}
        </Panel>
        <Panel title="Frequently Asked Questions" icon="❓" sub="Quick answers to common questions">
          <div className="space-y-2">
            {FAQS.map((f, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-white/10">
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between bg-white/[0.02] px-3.5 py-3 text-left text-sm font-semibold hover:bg-amber-400/5">
                  {f.q}<span className={`transition ${open === i ? "rotate-180" : ""}`}>⌄</span>
                </button>
                {open === i && <div className="border-t border-white/5 px-3.5 py-3 text-sm text-slate-400">{f.a}</div>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["📚", "Course Help", "Enrollment & learning"], ["💳", "Payment Help", "Orders & payments"], ["🔧", "Technical Help", "App & technical issues"]].map(([i, t, s]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-[#161626]/60 p-4 text-center"><div className="text-2xl">{i}</div><div className="text-sm font-bold">{t}</div><div className="text-[11px] text-slate-500">{s}</div></div>
        ))}
      </div>
      <Panel title="Contact Us" icon="📞">
        <div className="grid gap-3 sm:grid-cols-3">
          {wa && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 hover:bg-emerald-400/10"><div className="font-bold">💬 WhatsApp</div><div className="text-xs text-slate-400">Chat with our team</div><div className="mt-1 font-semibold text-emerald-400">{pretty(wa)}</div><div className="mt-1 text-xs text-emerald-300">Open WhatsApp →</div></a>}
          <a href={mailUrl} className="rounded-xl border border-pink-400/20 bg-pink-400/5 p-4 hover:bg-pink-400/10"><div className="font-bold">✉️ Email Support</div><div className="text-xs text-slate-400">We&apos;ll get back to you</div><div className="mt-1 font-semibold text-pink-300">{email}</div><div className="mt-1 text-xs text-pink-300">Contact Support →</div></a>
          {/* Available 24/7 — same third card as the desktop app */}
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.07] p-4">
            <div className="font-bold text-violet-200">🕐 Available 24/7</div>
            <div className="text-xs text-slate-400">Monday – Sunday</div>
            {wa ? <a href={`tel:+${wa}`} className="mt-1 block font-semibold text-violet-300 hover:text-white">{pretty(wa)}</a> : <div className="mt-1 font-semibold text-violet-300">Always here for you</div>}
            <div className="mt-1 text-xs text-violet-300/80">We reply as fast as we can 💜</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
