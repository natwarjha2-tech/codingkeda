import type { Metadata } from "next";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import RequestDemoForm from "@/components/site/RequestDemoForm";

export const metadata: Metadata = {
  title: "CodingKida for schools: coding curriculum for Class 4–12",
  description: "Ready-made coding lessons, quizzes, exercises and progress reports for schools. Request a free demo.",
  alternates: { canonical: "/for-schools" },
};

const BENEFITS = [
  { e: "📚", t: "Ready-made curriculum", d: "Video lessons, notes, quizzes and coding exercises, arranged class by class." },
  { e: "🧑‍🏫", t: "Less work for teachers", d: "Quizzes and code are checked automatically. Teachers focus on helping students." },
  { e: "📊", t: "Progress tracking", d: "Lessons watched, quiz scores and exercises solved are tracked for every student." },
  { e: "🎉", t: "Students stay motivated", d: "Medals, coins, XP, leaderboards and a weekly coding challenge." },
  { e: "🔴", t: "Live classes", d: "Live sessions with CodingKida teachers for doubt solving and practice." },
  { e: "🛡️", t: "Safe for children", d: "Parent verification and AI help that stays on the course material." },
];

const STEPS = [
  { t: "Demo call", d: "We show the platform and understand your classes and timetable." },
  { t: "Pick courses", d: "Choose subjects for each class: Python, Java, C, AI, Robotics and more." },
  { t: "Set up students", d: "Students get accounts and install the app on lab computers or phones." },
  { t: "Start learning", d: "Classes begin. We check in regularly and share progress." },
];

const FAQS = [
  { q: "Which classes does it cover?", a: "Class 4 to Class 12, from first programs to data structures and projects." },
  { q: "Do we need a computer lab?", a: "A lab is best for coding, but lessons and quizzes also work on phones and tablets." },
  { q: "Can the school see student progress?", a: "Progress, quiz scores and exercises are tracked for every student, and our team can share progress reports with the school." },
  { q: "How is pricing decided for schools?", a: "It depends on the number of students and courses. We share a quote after the demo." },
];

export default function ForSchoolsPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="🏫 For schools"
        title={<>Coding for every class in <span className="text-[#0EA5E9]">your school</span></>}
        text="A complete, fun coding programme for Class 4 to 12, with lessons, practice, live classes and progress reports."
        tint="from-[#E0F2FE] via-[#FFFBF5] to-[#EDE9FE]"
      />

      <section className="px-5 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map((b) => (
            <div key={b.t} className="rounded-[24px] bg-white border-2 border-[#E0F2FE] p-6">
              <div className="text-4xl">{b.e}</div>
              <h2 className="mt-3 text-xl font-black">{b.t}</h2>
              <p className="mt-1 text-[#4B5563]">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black">How we start</h2>
          <ol className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-[24px] bg-[#F0F9FF] p-5">
                <span className="w-10 h-10 rounded-full bg-[#0EA5E9] text-white font-black flex items-center justify-center">{i + 1}</span>
                <h3 className="mt-3 font-black">{s.t}</h3>
                <p className="text-[#4B5563]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="demo" className="px-5 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-3xl md:text-4xl font-black">Request a free demo</h2>
            <p className="mt-3 text-lg text-[#4B5563]">Fill in the form and our team will reach out within 2 working days.</p>
            <div className="mt-8 space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-[20px] border-2 border-[#E0F2FE] bg-white px-5 py-3 open:bg-[#F0F9FF]">
                  <summary className="cursor-pointer list-none font-black flex justify-between gap-3">{f.q}<span className="text-[#0EA5E9] group-open:rotate-45 transition-transform">+</span></summary>
                  <p className="mt-2 text-[#4B5563]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="lg:col-span-3">
            <RequestDemoForm />
          </div>
        </div>
      </section>
    </KidsPage>
  );
}
