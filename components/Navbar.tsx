"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, ChevronDown, User, ShieldCheck, LogOut } from "lucide-react";
import { getToken, logoutUser } from "@/services/auth";

const links = [
  { label: "Home",            scrollId: "hero" },
  { label: "Find My Course 🔥", scrollId: "survey" },
  { label: "Courses",        scrollId: "courses" },
  { label: "Watch Demo",     scrollId: "free-video" },
  { label: "Pricing",        scrollId: "pricing" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const router = useRouter();
  const pathname = usePathname();

  const scrollTo = (id: string) => {
    setOpen(false);
    if (pathname === "/") {
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } else {
      router.push(`/#${id}`);
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 border-b border-white/8 transition-all duration-300 ${scrolled ? "bg-[#0f0f1a]/98" : "bg-[#0f0f1a]/85"} backdrop-blur-xl`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center h-16 gap-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-white">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md object-contain" />
          CodingKeda
        </Link>

        <ul className="hidden md:flex items-center gap-7 ml-auto mr-16">
          {links.map((l) => (
            <li key={l.label}>
              <button
                onClick={() => scrollTo(l.scrollId)}
                className="text-slate-400 hover:text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3 ml-6">
          {loggedIn ? (
            <button
              onClick={() => { logoutUser(); setLoggedIn(false); router.push("/"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <LogOut size={15} /> Logout
            </button>
          ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setLoginDropdown(!loginDropdown)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white border border-white/10 px-4 py-2 rounded-lg hover:border-purple-500 transition-colors"
            >
              Log In <ChevronDown size={15} className={`transition-transform ${loginDropdown ? "rotate-180" : ""}`} />
            </button>
            {loginDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                <Link href="/login" onClick={() => setLoginDropdown(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <User size={16} className="text-purple-400" /> Student Login
                </Link>
                <div className="h-px bg-white/8" />
                <Link href="/admin/login" onClick={() => setLoginDropdown(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <ShieldCheck size={16} className="text-red-400" /> Admin Login
                </Link>
              </div>
            )}
          </div>
          )}
        </div>

        <button className="md:hidden ml-auto text-white" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-[#1a1a2e] border-t border-white/8 px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <button key={l.label} onClick={() => scrollTo(l.scrollId)}
              className="text-slate-300 text-sm font-medium text-left cursor-pointer">
              {l.label}
            </button>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            {loggedIn ? (
              <button
                onClick={() => { logoutUser(); setLoggedIn(false); setOpen(false); router.push("/"); }}
                className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-red-400 py-2 px-4 rounded-lg">
                <LogOut size={15} /> Logout
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-white py-2 px-4 rounded-lg">
                  <User size={15} className="text-purple-400" /> Student Login
                </Link>
                <Link href="/admin/login" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-white py-2 px-4 rounded-lg">
                  <ShieldCheck size={15} className="text-red-400" /> Admin Login
                </Link>
                <Link href="/signup?flow=free" onClick={() => setOpen(false)} className="text-center text-sm font-semibold bg-purple-600 text-white py-2 rounded-lg">
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
