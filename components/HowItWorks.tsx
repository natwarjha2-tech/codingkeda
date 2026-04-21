import { Lightbulb, Code2, FlaskConical, Trophy } from "lucide-react";

const steps = [
  { num: "01", icon: <Lightbulb size={28} />, title: "Understand Concepts", desc: "Simple, fun explanations of coding concepts designed for school students — no prior experience needed" },
  { num: "02", icon: <Code2 size={28} />, title: "Code Along", desc: "Follow along with live coding exercises. Write your first program in minutes, not months" },
  { num: "03", icon: <FlaskConical size={28} />, title: "Build Cool Projects", desc: "Create games, websites & apps that you can show your friends and family — learning by doing" },
  { num: "04", icon: <Trophy size={28} />, title: "Earn & Excel", desc: "Get certificates, build a portfolio and stay ahead of your peers in school & competitive exams" },
];

export default function HowItWorks() {
  return (
    <section className="bg-[#1a1a2e] py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">How <span className="gradient-text">CodingKeda</span> Works</h2>
          <p className="text-slate-400">A simple 4-step journey built for Class 6–12 students</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="bg-[#16213e] border border-white/8 rounded-2xl p-7 text-center relative hover:-translate-y-1 transition-transform">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{s.num}</span>
              <div className="text-purple-400 flex justify-center mb-4">{s.icon}</div>
              <h4 className="font-bold text-white mb-2">{s.title}</h4>
              <p className="text-slate-400 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
