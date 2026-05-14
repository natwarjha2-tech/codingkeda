"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, ChevronDown, User, ShieldCheck, LogOut, Search, BookOpen, Heart, Settings } from "lucide-react";
import { getToken, logoutUser } from "@/services/auth";
import SearchBar from "@/components/SearchBar";

const links = [
  { label: "Home",    scrollId: "hero" },
  { label: "Courses", scrollId: "pricing" },
];

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [userInitial, setUserInitial] = useState("U");
  const [profileDropdown, setProfileDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    setLoggedIn(!!token);
    if (token) {
      const email = localStorage.getItem("userEmail") || "";
      setUserInitial(email ? email.charAt(0).toUpperCase() : "U");
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 50);
      setHidden(current > lastScrollY.current && current > 80);
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdown(false);
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
    <nav className={`fixed top-0 w-full z-50 border-b border-white/8 transition-all duration-300 ${scrolled ? "bg-[#0f0f1a]/98" : "bg-[#0f0f1a]/85"} backdrop-blur-xl ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="px-6 md:px-10 flex items-center h-16 gap-4 relative">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-white flex-shrink-0">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md object-contain" />
          CodingKeda
        </Link>

        {/* Search Bar - near logo */}
        <div className="hidden md:flex ml-2">
          <SearchBar placeholder="Search for courses..." className="max-w-xs w-64" />
        </div>

        {/* Nav links - centered */}
        <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          {links.map((l) => (
            <button key={l.label}
              onClick={() => scrollTo(l.scrollId)}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Profile/Login - always at extreme right end */}
        <div className="hidden md:flex ml-auto flex-shrink-0">
          <div className="transition-opacity duration-300">
            {loggedIn === null ? (
              <div className="w-9 h-9" />
            ) : loggedIn ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdown(!profileDropdown)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white hover:scale-105 transition-all"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
                >
                  {userInitial}
                </button>
                {profileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-white/8">
                      <p className="text-sm font-semibold text-white truncate">{userInitial === "U" ? "User" : `${userInitial}...`}</p>
                      <p className="text-xs text-slate-400 truncate">{localStorage.getItem("userEmail") || ""}</p>
                    </div>
                    {/* Navigation Items */}
                    <Link href="/my-courses" onClick={() => setProfileDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                      <BookOpen size={15} className="text-purple-400" /> My Courses
                    </Link>
                    <Link href="/dashboard" onClick={() => setProfileDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                      <User size={15} className="text-purple-400" /> Dashboard
                    </Link>
                    <Link href="/wishlist" onClick={() => setProfileDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                      <Heart size={15} className="text-pink-400" /> Wishlist
                    </Link>
                    <div className="h-px bg-white/8" />
                    <Link href="/profile" onClick={() => setProfileDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                      <Settings size={15} className="text-slate-400" /> Edit Profile
                    </Link>
                    <div className="h-px bg-white/8" />
                    <button
                      onClick={() => { logoutUser(); setLoggedIn(false); setProfileDropdown(false); router.push("/"); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <LogOut size={15} className="text-red-400" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setLoginDropdown(!loginDropdown)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white border border-white/10 px-4 py-2 rounded-lg hover:border-purple-500 transition-colors whitespace-nowrap"
                >
                  Log In <ChevronDown size={15} className={`transition-transform ${loginDropdown ? "rotate-180" : ""}`} />
                </button>
                {loginDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
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
          </div>
        <div className="md:hidden ml-auto flex items-center gap-3">
          <button onClick={() => setSearchOpen(!searchOpen)} className="text-slate-400 hover:text-white transition-colors">
            <Search size={20} />
          </button>
          <button className="text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Search Expand */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3 bg-[#0f0f1a]/98">
          <SearchBar className="w-full" />
        </div>
      )}

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-[#1a1a2e] border-t border-white/8 px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <button key={l.label} onClick={() => scrollTo(l.scrollId)}
              className="text-slate-300 text-sm font-medium text-left cursor-pointer">
              {l.label}
            </button>
          ))}
          {loggedIn && (
            <>
              <Link href="/my-courses" onClick={() => setOpen(false)}
                className="text-slate-300 text-sm font-medium text-left cursor-pointer flex items-center gap-2">
                <BookOpen size={14} className="text-purple-400" /> My Courses
              </Link>
              <Link href="/wishlist" onClick={() => setOpen(false)}
                className="text-slate-300 text-sm font-medium text-left cursor-pointer flex items-center gap-2">
                <Heart size={14} className="text-pink-400" /> Wishlist
              </Link>
              <Link href="/profile" onClick={() => setOpen(false)}
                className="text-slate-300 text-sm font-medium text-left cursor-pointer flex items-center gap-2">
                <Settings size={14} className="text-slate-400" /> Edit Profile
              </Link>
            </>
          )}
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
