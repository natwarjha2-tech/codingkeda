import Image from "next/image";
import Link from "next/link";

const socialLinks = [
  { label: "YouTube", href: "#", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg> },
  { label: "Instagram", href: "#", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.3 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.3 7.2 2.3c1.2-.1 1.6-.1 4.8-.1zm0-2.2C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9C.3 21.3 2.7 23.7 7.1 23.9 8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 12 5.8zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg> },
  { label: "LinkedIn", href: "#", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.2 2.3 4.2 5.4v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm1.8 13H3.5V9h3.6v11.4zM22.2 0H1.8C.8 0 0 .8 0 1.8v20.4C0 23.2.8 24 1.8 24h20.4c1 0 1.8-.8 1.8-1.8V1.8C24 .8 23.2 0 22.2 0z"/></svg> },
  { label: "X", href: "#", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.9 1h3.7l-8 9.1L24 23h-7.4l-5.8-7.5L4.5 23H.8l8.6-9.8L0 1h7.6l5.2 6.8L18.9 1zm-1.3 19.8h2L6.5 3.2H4.3l13.3 17.6z"/></svg> },
];

export default function Footer() {
  return (
    <footer className="bg-[#080810] border-t border-white/8 pt-14 pb-6 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
        <div>
          <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-white mb-3">
            <Image src="/logo.jpg" alt="CodingKeda" width={32} height={32} className="rounded-md" />
            CodingKeda
          </Link>
          <p className="text-slate-400 text-sm mb-5 max-w-xs">India&apos;s most loved tech learning platform. Building the next generation of software engineers.</p>
          <div className="flex gap-4">
            {socialLinks.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label} className="text-slate-400 hover:text-purple-400 transition-colors">
                {s.svg}
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "Courses", links: ["Java Development", "Web Development", "Data Science", "DSA & Algorithms", "DevOps & Cloud"] },
          { title: "Company", links: ["About Us", "Careers", "Blog", "Press", "Contact"] },
          { title: "Support", links: ["Help Center", "Privacy Policy", "Terms of Service", "Refund Policy"] },
        ].map((col) => (
          <div key={col.title}>
            <h5 className="text-white font-bold text-sm mb-4">{col.title}</h5>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l}><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8 pt-6 text-center text-slate-500 text-xs">
        © 2025 CodingKeda (www.codingkeda.com). All rights reserved. Made with ❤️ in India.
      </div>
    </footer>
  );
}
