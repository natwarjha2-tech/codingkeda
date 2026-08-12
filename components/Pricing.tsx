import Link from "next/link";
import { Check } from "lucide-react";

export default function Pricing() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20" id="pricing">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Simple, <span className="gradient-text">Transparent Pricing</span></h2>
        <p className="text-slate-400">No hidden fees. Cancel anytime.</p>
      </div>
      <div className="max-w-sm mx-auto">
        <div className="bg-[#16213e] rounded-2xl p-8 border border-purple-500 shadow-[0_0_0_1px_#6c47ff] relative">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">Recommended</span>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Pro</p>
          <p className="text-4xl font-extrabold text-white mb-1">₹599<span className="text-base text-slate-400 font-normal">/month</span></p>
          <ul className="my-7 space-y-3">
            {[
              "3+ Courses",
              "24/7 Mentor Support",
              "AI Doubt Support",
            ].map((text) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <Check size={15} className="text-green-400 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="block text-center font-semibold py-3 rounded-xl transition-all bg-purple-600 hover:bg-purple-700 text-white">
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
