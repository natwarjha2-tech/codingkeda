"use client";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function FreeVideo() {
  return (
    <section className="bg-gradient-to-br from-[#1a0533] via-[#0f0f1a] to-[#001a33] py-20 px-6" id="free-video">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            🎁 100% Free
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Watch a Free Lesson Right Now</h2>
          <p className="text-slate-400">No signup needed. Get a taste of our teaching quality.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          <div className="flex-[1.4] w-full rounded-2xl overflow-hidden shadow-2xl aspect-video">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/eIrMbAQSU34?rel=0&modestbranding=1"
              title="Java Tutorial for Beginners"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="flex-1">
            <span className="bg-purple-500/20 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full">Java Fundamentals · Lesson 1</span>
            <h3 className="text-xl font-bold text-white mt-4 mb-3">Java for Beginners – Variables, Data Types & OOP Concepts</h3>
            <p className="text-slate-400 text-sm mb-6">In this free lesson, you&apos;ll learn the core building blocks of Java programming. Taught by Rahul Sharma (IIT Delhi, 10+ years experience).</p>
            <ul className="space-y-3 mb-8">
              {["Variables & Data Types", "Object Oriented Programming", "Methods & Classes", "Hands-on coding exercise"].map(p => (
                <li key={p} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle size={16} className="text-green-400 shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="hidden md:inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-all">
              Continue Learning Free <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
