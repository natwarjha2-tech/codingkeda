"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiCached } from "../api";
import { PageHeader } from "@/components/my/ui";

const parseCount = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v || "").trim().toUpperCase();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return s.endsWith("K") ? n * 1000 : s.endsWith("M") ? n * 1_000_000 : n;
};
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+` : `${n}`);

export default function AboutPage() {
  const [courses, setCourses] = useState<string>("—");
  const [students, setStudents] = useState<string>("—");
  const [rating, setRating] = useState<{ v: string; sub: string }>({ v: "—", sub: "No ratings yet" });
  const [email, setEmail] = useState("support@codingkida.com");

  useEffect(() => {
    apiCached("/api/courses", (d) => {
      const list = d.courses || [];
      if (list.length) {
        setCourses(`${list.length}+`);
        const total = list.reduce((s: number, c: { students?: unknown; enrolledStudents?: number }) => s + (c.enrolledStudents ?? parseCount(c.students)), 0);
        if (total > 0) setStudents(fmt(total));
      }
    }).catch(() => {});
    apiCached("/api/feedback/lesson?lessonId=app_rating", (d) => {
      if (d.avgRating > 0) setRating({ v: Number(d.avgRating).toFixed(1), sub: `Based on ${d.totalReviews} review${d.totalReviews === 1 ? "" : "s"}` });
    }).catch(() => {});
    apiCached("/api/app-config", (d) => { if (/.+@.+\..+/.test(d.supportEmail || "")) setEmail(d.supportEmail); }).catch(() => {});
  }, []);

  const stats = [
    { i: "👥", v: students, l: "Students", s: "Learning & growing with us", c: "#a78bfa" },
    { i: "📖", v: courses, l: "Courses", s: "Curated for young coders", c: "#6ee7b7" },
    { i: "⭐", v: rating.v, l: "Rating", s: rating.sub, c: "#fbbf24" },
    { i: "🎧", v: "24/7", l: "Support", s: "We're here to help you anytime", c: "#67e8f9" },
  ];
  const links = [
    { href: "/", t: "Website", s: "Visit our official website", i: "🌐" },
    { href: "/privacy", t: "Privacy Policy", s: "Read our privacy policy", i: "🛡️" },
    { href: "/terms", t: "Terms & Conditions", s: "Read our terms and conditions", i: "📄" },
    { href: `mailto:${email}`, t: `Contact: ${email}`, s: "We'll get back to you", i: "✉️" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pt-2">
      <PageHeader icon="ℹ️" title="About" sub="Learn. Code. Grow." />
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-[#12121f]/90 p-8 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="CodingKida" className="relative mx-auto mb-3 h-20 w-20 rounded-2xl object-cover" />
        <h2 className="relative text-2xl font-extrabold">CodingKida</h2>
        <p className="relative font-semibold text-violet-300">Learn. Code. Grow.</p>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-slate-400">Making programming simple, engaging and accessible for every young learner in India.</p>
      </section>
      <section className="rounded-2xl border border-violet-400/10 bg-[#161626]/75 p-5">
        <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Our Numbers</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((x) => (
            <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: `${x.c}18` }}>{x.i}</div>
              <div className="text-2xl font-extrabold" style={{ color: x.c }}>{x.v}</div>
              <div className="text-sm font-semibold">{x.l}</div>
              <div className="text-[11px] text-slate-500">{x.s}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Links</div>
        <div className="space-y-1.5">
          {links.map((l) => (
            <Link key={l.t} href={l.href} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-white/5">
              <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">{l.i}</span><span><span className="block text-sm font-semibold">{l.t}</span><span className="block text-xs text-slate-500">{l.s}</span></span></span>
              <span className="text-slate-500">›</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="py-3 text-center text-xs text-slate-600">© {new Date().getFullYear()} CodingKida. All rights reserved.</div>
    </div>
  );
}
