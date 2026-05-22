"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, ChevronDown, User, ShieldCheck, LogOut, Search, BookOpen, Settings } from "lucide-react";
import { getToken, logoutUser } from "@/services/auth";
import SearchBar from "@/components/SearchBar";
import { useAuthModal } from "@/context/AuthModalContext";
import DesktopAuthModal from "@/components/DesktopAuthModal";
import AdminAuthModal from "@/components/AdminAuthModal";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { openAuthModal } = useAuthModal();
  const [desktopAuthOpen, setDesktopAuthOpen] = useState(false);
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    setLoggedIn(!!token);
    if (token) {
      const email = localStorage.getItem("userEmail") || "";
      setUserInitial(email ? email.charAt(0).toUpperCase() : "U");
      // Get role from stored user data
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        if (userData.role) setUserRole(userData.role);
      } catch {}
      // Fetch avatar from server
      fetch("/api/student/avatar", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => { if (data.success && data.avatarUrl) setAvatarUrl(data.avatarUrl); })
        .catch(() => {});
    }
  }, []);

  // Listen for avatar updates from profile page
  useEffect(() => {
    const handleAvatarUpdate = () => {
      const token = getToken();
      if (token) {
        fetch("/api/student/avatar", { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => { if (data.success && data.avatarUrl) setAvatarUrl(data.avatarUrl); })
          .catch(() => {});
      }
    };
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdate);
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
      <div className="px-4 md:px-10 flex items-center h-16 gap-4 relative">
        {/* MOBILE: Hamburger + Logo (left) */}
        <div className="flex md:hidden items-center gap-2">
          <button className="text-white p-1" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/" className="flex items-center gap-1.5 font-extrabold text-sm text-white">
            <Image src="/logo.jpg" alt="CodingKeda" width={26} height={26} className="rounded-md object-contain" />
            CodingKeda
          </Link>
        </div>

        {/* MOBILE: Login/Profile (right) */}
        <div className="flex md:hidden ml-auto">
          {loggedIn === null ? (
            <div className="w-9 h-9" />
          ) : loggedIn ? (
            <Link href="/profile"
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden"
              style={{ background: avatarUrl ? "none" : "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                userInitial
              )}
            </Link>
          ) : (
            <button onClick={() => openAuthModal()}
              className="text-xs font-semibold text-white bg-purple-600 px-3.5 py-2 rounded-lg whitespace-nowrap">
              Login/Register
            </button>
          )}
        </div>

        {/* DESKTOP: Logo (left) — UNCHANGED */}
        <Link href="/" className="hidden md:flex items-center gap-2 font-extrabold text-xl text-white flex-shrink-0">
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
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white hover:scale-105 transition-all overflow-hidden"
                  style={{ background: avatarUrl ? "none" : "linear-gradient(135deg,#7c3aed,#ec4899)" }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    userInitial
                  )}
                </button>
                {profileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-white/8">
                      <p className="text-sm font-semibold text-white truncate">{userInitial === "U" ? "User" : `${userInitial}...`}</p>
                      <p className="text-xs text-slate-400 truncate">{localStorage.getItem("userEmail") || ""}</p>
                      {userRole === "admin" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">Admin</span>
                      )}
                    </div>
                    {/* Navigation Items — Role-based */}
                    {userRole === "admin" ? (
                      <>
                        <Link href="/admin/dashboard" onClick={() => setProfileDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                          <ShieldCheck size={15} className="text-red-400" /> Admin Panel
                        </Link>
                        <div className="h-px bg-white/8" />
                        <Link href="/profile" onClick={() => setProfileDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                          <Settings size={15} className="text-slate-400" /> Edit Profile
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href="/my-courses" onClick={() => setProfileDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                          <BookOpen size={15} className="text-purple-400" /> My Courses
                        </Link>
                        <Link href="/dashboard" onClick={() => setProfileDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                          <User size={15} className="text-purple-400" /> Dashboard
                        </Link>
                        <div className="h-px bg-white/8" />
                        <Link href="/profile" onClick={() => setProfileDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                          <Settings size={15} className="text-slate-400" /> Edit Profile
                        </Link>
                      </>
                    )}
                    <div className="h-px bg-white/8" />
                    <button
                      onClick={() => { logoutUser(); setLoggedIn(false); setProfileDropdown(false); localStorage.removeItem("user"); localStorage.removeItem("userEmail"); localStorage.removeItem("ck_token"); router.push("/"); }}
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
                  className="relative flex items-center gap-1.5 text-xs font-bold text-white px-5 py-3 rounded-xl whitespace-nowrap transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] bg-purple-600 hover:bg-purple-700"
                  style={{
                    boxShadow: "0 4px 15px rgba(124,58,237,0.35)",
                  }}
                >
                  Login/Register <ChevronDown size={15} className={`transition-transform ${loginDropdown ? "rotate-180" : ""}`} />
                </button>
                {loginDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    <button onClick={() => { setLoginDropdown(false); setDesktopAuthOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left">
                      <User size={16} className="text-purple-400" /> Student Login
                    </button>
                    <div className="h-px bg-white/8" />
                    <button onClick={() => { setLoginDropdown(false); setAdminAuthOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left">
                      <ShieldCheck size={16} className="text-red-400" /> Admin Login
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
      </div>

      {/* Mobile Menu — Portal (full screen overlay, works on all pages) */}
      {open && mounted && createPortal(
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-[9999] bg-[#0f0f1a] overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Search inside menu */}
            <div className="pb-3 border-b border-white/8">
              <SearchBar placeholder="Search for courses..." className="w-full" />
            </div>

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
                <Link href="/profile" onClick={() => setOpen(false)}
                  className="text-slate-300 text-sm font-medium text-left cursor-pointer flex items-center gap-2">
                  <Settings size={14} className="text-slate-400" /> Edit Profile
                </Link>
                {userRole === "admin" && (
                  <Link href="/admin/dashboard" onClick={() => setOpen(false)}
                    className="text-slate-300 text-sm font-medium text-left cursor-pointer flex items-center gap-2">
                    <ShieldCheck size={14} className="text-red-400" /> Admin Panel
                  </Link>
                )}
              </>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {loggedIn ? (
                <button
                  onClick={() => { logoutUser(); setLoggedIn(false); setOpen(false); localStorage.removeItem("user"); localStorage.removeItem("userEmail"); localStorage.removeItem("ck_token"); router.push("/"); }}
                  className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-red-400 py-2 px-4 rounded-lg">
                  <LogOut size={15} /> Logout
                </button>
              ) : (
                <>
                  <button onClick={() => { setOpen(false); openAuthModal(); }} className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-white py-2 px-4 rounded-lg w-full">
                    <User size={15} className="text-purple-400" /> Student Login
                  </button>
                  <Link href="/admin/login" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-semibold border border-white/10 text-white py-2 px-4 rounded-lg">
                    <ShieldCheck size={15} className="text-red-400" /> Admin Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Desktop Auth Modal */}
      <DesktopAuthModal isOpen={desktopAuthOpen} onClose={() => setDesktopAuthOpen(false)} />
      {/* Admin Auth Modal */}
      <AdminAuthModal isOpen={adminAuthOpen} onClose={() => setAdminAuthOpen(false)} />
    </nav>
  );
}
