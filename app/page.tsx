import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CoursesSection from "@/components/CoursesSection";
import FreeVideo from "@/components/FreeVideo";
import HowItWorks from "@/components/HowItWorks";
import Founders from "@/components/Founders";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <CoursesSection />
      <FreeVideo />
      <HowItWorks />
      <Founders />
      <Pricing />

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-purple-600 to-orange-500 py-20 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Ready to Start Your Tech Journey?</h2>
        <p className="text-white/85 mb-8">Specially designed for Class 6–12 students. First 7 days completely free.</p>
        <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-purple-600 font-bold px-8 py-4 rounded-xl hover:-translate-y-0.5 hover:shadow-xl transition-all">
          Start Learning Today <ArrowRight size={18} />
        </Link>
      </section>

      <Footer />
    </main>
  );
}
