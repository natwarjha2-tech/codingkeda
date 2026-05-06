"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import COURSES from "@/data/courses";
import { getToken } from "@/services/auth";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSearch?: (value: string) => void;
}

export default function SearchBar({
  placeholder = "Search for courses, projects, or languages...",
  className = "",
  onSearch,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = value.trim()
    ? COURSES.filter((c) =>
        c.name.toLowerCase().includes(value.toLowerCase()) ||
        c.tag.toLowerCase().includes(value.toLowerCase()) ||
        c.desc.toLowerCase().includes(value.toLowerCase())
      )
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setShowSuggestions(true);
    onSearch?.(e.target.value);
  };

  const handleClear = () => {
    setValue("");
    setShowSuggestions(false);
    onSearch?.("");
  };

  const handleSelect = (slug: string) => {
    setShowSuggestions(false);
    setValue("");
    const token = getToken();
    if (token) {
      router.push(`/payment?package=${encodeURIComponent(slug)}`);
    } else {
      router.push(`/signup?flow=survey&course=${encodeURIComponent(slug)}`);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border transition-all duration-200 ${
          focused
            ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
            : "border-white/10"
        }`}
      >
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => { setFocused(true); setShowSuggestions(true); }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="bg-transparent outline-none text-sm text-white placeholder:text-slate-500 w-full"
        />
        {value && (
          <button onClick={handleClear} className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#16213e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {suggestions.map((course) => (
            <button
              key={course.id}
              onMouseDown={() => handleSelect(course.slug)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-xl">{course.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-white">{course.name}</p>
                <p className="text-xs text-slate-400">{course.tag} · {course.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
