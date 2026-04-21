"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Courses", href: "/#courses" },
  { label: "Free Lesson", href: "/#free-video" },
  { label: "Our Founders", href: "/#founders" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 border-b border-white/8 transition-all duration-300 ${scrolled ? "bg-[#0f0f1a]/98" : "bg-[#0f0f1a]/85"} backdrop-blur-xl`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center h-16 gap-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-white">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md object-contain" />
          CodingKeda
        </Link>

        <ul className="hidden md:flex items-center gap-7 ml-auto">
          {links.map((l) => (
            <li key={l.label}>
              <Link href={l.href} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3 ml-6">
          <Link href="/login" className="text-sm font-semibold text-white border border-white/10 px-4 py-2 rounded-lg hover:border-purple-500 transition-colors">
            Log In
          </Link>
          <Link href="/signup" className="text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
            Start Free
          </Link>
        </div>

        <button className="md:hidden ml-auto text-white" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#1a1a2e] border-t border-white/8 px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="text-slate-300 text-sm font-medium" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1 text-center text-sm font-semibold border border-white/10 text-white py-2 rounded-lg">Log In</Link>
            <Link href="/signup" className="flex-1 text-center text-sm font-semibold bg-purple-600 text-white py-2 rounded-lg">Start Free</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
