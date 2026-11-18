import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * Shared layout for the public legal pages (/terms, /privacy).
 * `embed` (?embed=1): shown inside the sign-up "read the terms" window of the
 * website and apps — no site menu or footer, so the student stays on sign-up.
 */
export default function LegalPage({
  title,
  effective,
  children,
  embed = false,
}: {
  title: string;
  effective: string;
  children: React.ReactNode;
  embed?: boolean;
}) {
  return (
    <>
      {!embed && <Navbar />}
      <main className={embed ? "bg-white py-5 px-4" : "min-h-screen bg-white pt-24 pb-16 px-4"}>
        <article className="max-w-3xl mx-auto text-slate-700 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1 [&_a]:text-purple-700 [&_a]:underline [&_table]:w-full [&_table]:text-sm [&_table]:mb-4 [&_th]:text-left [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:p-2 [&_td]:border-t [&_td]:border-slate-200 [&_td]:align-top">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">{title}</h1>
          <p className="text-sm text-slate-500 mb-6">Effective date: {effective}</p>
          {children}
        </article>
      </main>
      {!embed && <Footer />}
    </>
  );
}
