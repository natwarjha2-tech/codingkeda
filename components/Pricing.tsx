import Link from "next/link";
import { Check, X } from "lucide-react";

const plans = [
  {
    name: "Free", price: "₹0", period: "/month", popular: false,
    features: [
      { text: "5 free courses", ok: true },
      { text: "Community access", ok: true },
      { text: "1 free project", ok: true },
      { text: "Certificate", ok: false },
      { text: "Placement support", ok: false },
    ],
    cta: "Get Started", href: "/signup", outline: true,
  },
  {
    name: "Pro", price: "₹499", period: "/month", popular: true,
    features: [
      { text: "All 200+ courses", ok: true },
      { text: "Live doubt sessions", ok: true },
      { text: "Unlimited projects", ok: true },
      { text: "Verified certificate", ok: true },
      { text: "Job board access", ok: true },
    ],
    cta: "Start Pro Free", href: "/signup", outline: false,
  },
  {
    name: "Placement", price: "₹999", period: "/month", popular: false,
    features: [
      { text: "Everything in Pro", ok: true },
      { text: "1-on-1 mentorship", ok: true },
      { text: "Resume review", ok: true },
      { text: "Mock interviews", ok: true },
      { text: "Placement guarantee*", ok: true },
    ],
    cta: "Get Placed", href: "/signup", outline: true,
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
        {plans.map((p) => (
          <div key={p.name} className={`bg-[#16213e] rounded-2xl p-8 border relative ${p.popular ? "border-purple-500 shadow-[0_0_0_1px_#6c47ff]" : "border-white/8"}`}>
            {p.popular && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">Most Popular</span>
            )}
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">{p.name}</p>
            <p className="text-4xl font-extrabold text-white mb-1">{p.price}<span className="text-base text-slate-400 font-normal">{p.period}</span></p>
            <ul className="my-7 space-y-3">
              {p.features.map((f) => (
                <li key={f.text} className={`flex items-center gap-3 text-sm ${f.ok ? "text-slate-300" : "text-slate-500"}`}>
                  {f.ok ? <Check size={15} className="text-green-400 shrink-0" /> : <X size={15} className="text-slate-600 shrink-0" />}
                  {f.text}
                </li>
              ))}
            </ul>
            <Link href={p.href} className={`block text-center font-semibold py-3 rounded-xl transition-all ${p.outline ? "border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white" : "bg-purple-600 hover:bg-purple-700 text-white"}`}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
