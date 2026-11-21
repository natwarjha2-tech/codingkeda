const POINTS = [
  { e: "🛡️", t: "Parent verification", d: "Children's profiles are verified with a parent's email or phone before full access." },
  { e: "📊", t: "Progress you can see", d: "Lessons watched, quiz scores, exercises solved and a weekly report in the app." },
  { e: "🎯", t: "Real skills, step by step", d: "A clear path from first program to problem solving, matched to the child's class." },
  { e: "🤖", t: "Safe AI help", d: "The AI helper answers from the course material, so explanations stay on topic." },
];

/** For parents: safety and progress. */
export default function ParentsSection() {
  return (
    <section id="parents" className="px-5 py-16 md:py-20 bg-[#FFF7E6]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-2">
          <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-black text-[#B45309] border-2 border-[#FDE68A]">👨‍👩‍👧 For parents</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-black text-[#1E1B4B] leading-tight">Screen time that builds real skills</h2>
          <p className="mt-4 text-lg text-[#4B5563]">
            Your child learns at their own pace on a phone or a computer. You can see how they are doing at any time.
          </p>
        </div>
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {POINTS.map((p) => (
            <div key={p.t} className="rounded-[24px] bg-white p-6 border-2 border-[#FDE68A] border-b-[6px]">
              <div className="text-4xl">{p.e}</div>
              <h3 className="mt-3 text-lg font-black text-[#1E1B4B]">{p.t}</h3>
              <p className="mt-1 text-[#4B5563]">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
