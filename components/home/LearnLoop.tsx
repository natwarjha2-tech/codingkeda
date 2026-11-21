const STEPS = [
  { emoji: "🎬", title: "Watch", text: "Short, clear video lessons made for school students.", bg: "bg-[#FFE4E6]", ink: "text-[#BE123C]" },
  { emoji: "🧠", title: "Quiz", text: "Quick questions after every lesson to check what you learnt.", bg: "bg-[#FEF3C7]", ink: "text-[#B45309]" },
  { emoji: "💻", title: "Code", text: "Write real programs in Python, Java or C. Your code is checked instantly.", bg: "bg-[#DCFCE7]", ink: "text-[#15803D]" },
  { emoji: "🥇", title: "Win", text: "Earn Gold, Silver and Bronze medals and coins for the top scores.", bg: "bg-[#E0F2FE]", ink: "text-[#0369A1]" },
  { emoji: "⭐", title: "Level up", text: "Every activity gives XP. Every 100 XP is a new level!", bg: "bg-[#EDE9FE]", ink: "text-[#6D28D9]" },
];

/** Watch → Quiz → Code → Win → Level up. */
export default function LearnLoop() {
  return (
    <section id="how" className="px-5 py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-[#1E1B4B]">How you learn 🧩</h2>
          <p className="mt-3 text-lg text-[#6B7280]">Five simple steps in every lesson.</p>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`${s.bg} relative rounded-[28px] p-6 text-center`}>
              <span className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white text-sm font-black text-[#1E1B4B] flex items-center justify-center shadow-sm">{i + 1}</span>
              <div className="mx-auto w-20 h-20 rounded-full bg-white flex items-center justify-center text-5xl shadow-sm">{s.emoji}</div>
              <h3 className={`mt-4 text-2xl font-black ${s.ink}`}>{s.title}</h3>
              <p className="mt-2 text-[#374151] leading-snug">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { e: "🔥", t: "Weekly coding challenge", d: "One new problem every Monday. Be the first to solve it and become Weekly Champion!" },
            { e: "🏆", t: "Leaderboards", d: "See your rank for every lesson quiz and exercise, and for the whole course." },
            { e: "🤖", t: "Codo, your AI helper", d: "Stuck? Ask Codo. Answers come from your own course material." },
          ].map((f) => (
            <div key={f.t} className="rounded-[24px] border-2 border-[#EDE9FE] bg-[#FAFAFF] p-6 flex gap-4">
              <div className="text-4xl">{f.e}</div>
              <div>
                <h4 className="text-lg font-black text-[#1E1B4B]">{f.t}</h4>
                <p className="mt-1 text-[#4B5563]">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
