import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CoursesSection from "@/components/CoursesSection";
import FreeVideo from "@/components/FreeVideo";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import Founders from "@/components/Founders";
import Footer from "@/components/Footer";
import BrandText from "@/components/BrandText";
import ScrollToHash from "@/components/ScrollToHash";
import Link from "next/link";
import { ArrowRight, Cpu, BookOpen, Monitor, Users } from "lucide-react";

export default function Home() {
  return (
    <main>
      <Navbar />

      <ScrollToHash />
      {/* 1. Hero */}
      <Hero />

      {/* 2. Learning Flow */}
      <HowItWorks />

      {/* 5. Free Video */}
      <FreeVideo />

      {/* 6. Why CodingKeda */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Why <span className="gradient-text">CodingKeda?</span></h2>
          <p className="text-slate-400">What makes us different from other platforms</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <BookOpen size={28} className="text-purple-400" />, title: "Structured Roadmap", desc: "Clear learning path from beginner to job-ready. No confusion, no overwhelm." },
            { icon: <Cpu size={28} className="text-orange-400" />, title: "AI Doubt Support", desc: "Get instant answers to your coding doubts 24/7 with our built-in AI assistant." },
            { icon: <Monitor size={28} className="text-green-400" />, title: "Desktop + Offline", desc: "Download our desktop app and learn even without internet. Learn anywhere, anytime." },
            { icon: <Users size={28} className="text-blue-400" />, title: "Community Learning", desc: "Join 5,000+ students. Ask doubts, share projects, grow together." },
          ].map((item) => (
            <div key={item.title} className="bg-[#16213e] border border-white/8 rounded-2xl p-7 hover:-translate-y-1 transition-transform">
              <div className="mb-4">{item.icon}</div>
              <h4 className="font-bold text-white mb-2">{item.title}</h4>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Founders */}
      <Founders />

      {/* 8. Pricing */}
      <Pricing />

      {/* 9. CTA Banner */}
      <section className="bg-gradient-to-r from-purple-600 to-orange-500 py-20 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Ready to Start Your Tech Journey?</h2>
        <p className="text-white/85 mb-8">Join 5,000+ students. First 7 days completely free.</p>
        <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-purple-600 font-bold px-8 py-4 rounded-xl hover:-translate-y-0.5 hover:shadow-xl transition-all">
          Start Learning Today <ArrowRight size={18} />
        </Link>
      </section>

      <BrandText />
      <Footer />
    </main>
  );
}
