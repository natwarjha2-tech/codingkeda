import Link from "next/link";

/** "Who are you?" — separate paths for kids, parents and schools (like Khan Academy / CodeMonkey). */
const ROLES = [
  {
    e: "🧒", t: "I'm a student", d: "Play puzzles, watch free lessons and start coding today.",
    points: ["Free lessons", "Puzzles & playground", "Medals and XP"],
    href: "/free-learning", cta: "Start free →", bg: "bg-[#DCFCE7]", edge: "border-[#86EFAC]", btn: "bg-[#22C55E] border-[#15803D]",
  },
  {
    e: "👨‍👩‍👧", t: "I'm a parent", d: "Safe, structured learning you can track, at one simple price.",
    points: ["Parent verification", "Progress & weekly report", "Certificates"],
    href: "/#parents", cta: "Why parents choose us →", bg: "bg-[#FFF7E6]", edge: "border-[#FDE68A]", btn: "bg-[#F59E0B] border-[#B45309]",
  },
  {
    e: "🏫", t: "I'm a school", d: "A ready-made coding programme for Class 4 to 12.",
    points: ["Curriculum by class", "Live classes", "Free demo"],
    href: "/for-schools#demo", cta: "Request a demo →", bg: "bg-[#E0F2FE]", edge: "border-[#7DD3FC]", btn: "bg-[#0EA5E9] border-[#0369A1]",
  },
];

export default function RoleStrip() {
  return (
    <section aria-label="Choose your path" className="px-5 pb-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <Link key={r.t} href={r.href} className={`${r.bg} ${r.edge} group rounded-[28px] border-2 border-b-8 p-6 hover:-translate-y-1 transition-transform`}>
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-3xl shadow-sm">{r.e}</span>
              <h2 className="text-2xl font-black text-[#1E1B4B]">{r.t}</h2>
            </div>
            <p className="mt-3 text-[#374151]">{r.d}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {r.points.map((p) => <li key={p} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#374151]">✓ {p}</li>)}
            </ul>
            <span className={`${r.btn} mt-5 inline-block rounded-2xl border-b-[5px] px-5 py-2.5 font-black text-white`}>{r.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
