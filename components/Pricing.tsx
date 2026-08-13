import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "ZenAlpha Basic",
    price: "₹499",
    period: "/month",
    features: ["Concepts through Animated Videos", "AI Doubt Support", "Mobile App Support", "Direct Contact with CodingKida Teacher", "Online & Offline Support", "Desktop App"],
    color: "border-blue-500",
    badge: null,
    cta: "Get Started",
  },
  {
    name: "ZenAlpha Advance",
    price: "₹699",
    period: "/month",
    features: ["Basic + Advanced Courses", "AI Doubt Support", "Integrated Coding Editor", "Mobile App Support", "Project-Based Learning", "Desktop App + Offline", "Priority Support"],
    color: "border-purple-500",
    badge: "Most Popular",
    cta: "Get Started",
  },
  {
    name: "ZenBeta",
    price: "₹499",
    period: "/month",
    features: ["Specialized Track", "AI Doubt Support", "Integrated Coding Editor", "Project-Based Learning", "Desktop App"],
    color: "border-orange-500",
    badge: null,
    cta: "Get Started",
  },
];

export default function Pricing() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20" id="pricing">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Simple, <span className="gradient-text">Transparent Pricing</span></h2>
        <p className="text-slate-400">No hidden fees. Cancel anytime.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div key={plan.name} className={`bg-[#16213e] rounded-2xl p-7 border ${plan.color} relative ${plan.badge ? "shadow-[0_0_0_1px_#6c47ff]" : ""}`}>
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
            )}
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">{plan.name}</p>
            <p className="text-3xl font-extrabold text-white mb-1">{plan.price}<span className="text-base text-slate-400 font-normal">{plan.period}</span></p>
            <ul className="my-6 space-y-3">
              {plan.features.map((text) => (
                <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                  <Check size={15} className="text-green-400 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/signup" className={`block text-center font-semibold py-3 rounded-xl transition-all ${plan.badge ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-white/8 hover:bg-white/14 text-white border border-white/10"}`}>
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
