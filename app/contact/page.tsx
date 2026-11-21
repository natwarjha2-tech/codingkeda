import type { Metadata } from "next";
import Link from "next/link";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import { LEGAL } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Contact CodingKida",
  description: "Questions about courses, payments or your account? Here is how to reach the CodingKida team.",
  alternates: { canonical: "/contact" },
};

// Only show company details that have been filled in (placeholders start with "[").
const real = (v: string) => (v && !v.startsWith("[") ? v : null);

const SOCIAL = [
  { e: "▶️", t: "YouTube", href: "https://youtube.com/@codingkida4u" },
  { e: "📸", t: "Instagram", href: "https://www.instagram.com/codingkida4u" },
  { e: "✖️", t: "X (Twitter)", href: "https://x.com/CodingKida4U" },
];

export default function ContactPage() {
  const email = real(LEGAL.supportEmail);
  const phone = real(LEGAL.phone);

  return (
    <KidsPage>
      <PageHeader badge="💬 We are here to help" title="Contact us" text="Questions about a course, a payment or your account? Reach us any of these ways." />
      <section className="px-5 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] border-b-8 p-7">
            <div className="text-4xl">📱</div>
            <h2 className="mt-3 text-2xl font-black">Help inside the app</h2>
            <p className="mt-2 text-[#4B5563]">The fastest way: open the CodingKida app, go to <b>Profile → Help &amp; Support</b> and send us a message.</p>
            <Link href="/download" className="mt-5 inline-block rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white border-b-[5px] border-[#5B21B6]">Get the app</Link>
          </div>

          <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] border-b-8 p-7">
            <div className="text-4xl">✉️</div>
            <h2 className="mt-3 text-2xl font-black">Email or call</h2>
            {email || phone ? (
              <ul className="mt-3 space-y-2 text-lg font-bold">
                {email && <li><a href={`mailto:${email}`} className="text-[#6D28D9] underline">{email}</a></li>}
                {phone && <li><a href={`tel:${phone.replace(/\s/g, "")}`} className="text-[#6D28D9] underline">{phone}</a></li>}
              </ul>
            ) : (
              <p className="mt-2 text-[#4B5563]">Please use Help &amp; Support in the app, or message us on social media.</p>
            )}
          </div>

          <div className="md:col-span-2 rounded-[28px] bg-[#FFF7E6] border-2 border-[#FDE68A] p-7">
            <h2 className="text-2xl font-black">Follow us 🎈</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {SOCIAL.map((s) => (
                <a key={s.t} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white px-5 py-3 font-black border-2 border-[#FDE68A] hover:-translate-y-0.5 transition-transform">
                  {s.e} {s.t}
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { t: "Common questions", href: "/#faq", e: "🙋" },
              { t: "Refund policy", href: "/terms#refunds", e: "💸" },
              { t: "Delete my account", href: "/delete-account", e: "🗑️" },
            ].map((l) => (
              <Link key={l.t} href={l.href} className="rounded-[20px] bg-white border-2 border-[#EDE9FE] p-5 font-black hover:-translate-y-0.5 transition-transform">
                {l.e} {l.t} →
              </Link>
            ))}
          </div>
        </div>
      </section>
    </KidsPage>
  );
}
