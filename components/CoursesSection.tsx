"use client";
import { useState } from "react";
import Link from "next/link";
import { Star, Clock, Users } from "lucide-react";

const courses = [
  { id: 1, cat: "genZ", icon: "🎮", gradient: "from-blue-500 to-purple-600", badge: "Popular", badgeColor: "bg-yellow-400 text-black", title: "GEN-Z Coders - Python & Game Dev", desc: "Learn Python programming through fun games and projects. Perfect for Class 6-10 students.", rating: "4.9", reviews: "850", hours: "40", students: "2.5K", instructor: "Natwar Kumar Jha", college: "Sr. Architect, Volvo", avatar: "https://i.pravatar.cc/32?img=33", price: "₹499", original: "₹2,499", tags: ["Python", "Games"] },
  { id: 2, cat: "zenAlpha", icon: "🚀", gradient: "from-orange-500 to-pink-600", badge: "New", badgeColor: "bg-green-400 text-black", title: "ZEN-Alpha - Web Dev for Young Minds", desc: "Build your own websites with HTML, CSS & JavaScript. Designed for Class 8-12 students.", rating: "4.8", reviews: "620", hours: "35", students: "1.8K", instructor: "Sudhanshu Shekhar Pathak", college: "Sr. Faculty, Allen", avatar: "https://i.pravatar.cc/32?img=11", price: "₹599", original: "₹2,999", tags: ["HTML", "CSS", "JS"] },
];

const tabs = ["All Courses"];
const filterMap: Record<string, string> = { "All": "all", "Programming": "programming", "Web Dev": "web", "Data Science": "data", "DSA": "dsa" };

export default function CoursesSection() {
  const [active, setActive] = useState("All");
  const filtered = courses;

  return (
    <section className="max-w-7xl mx-auto px-6 py-20" id="courses">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Our <span className="gradient-text">Learning Programs</span></h2>
        <p className="text-slate-400">Specially designed for Class 6-12 students by industry experts</p>
      </div>

      <div className="flex gap-2 justify-center flex-wrap mb-10">
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${active === t ? "bg-purple-600 border-purple-600 text-white" : "border-white/10 text-slate-400 hover:border-purple-500 hover:text-white"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(c => (
          <div key={c.id} className="bg-[#16213e] border border-white/8 rounded-2xl overflow-hidden hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300">
            <div className={`h-36 bg-gradient-to-br ${c.gradient} flex items-center justify-center text-5xl relative`}>
              {c.icon}
              {c.badge && <span className={`absolute top-3 right-3 ${c.badgeColor} text-xs font-bold px-3 py-1 rounded-full`}>{c.badge}</span>}
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-2">
                {c.tags.map(t => <span key={t} className="bg-purple-500/15 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full">{t}</span>)}
              </div>
              <h3 className="font-bold text-white mb-1.5">{c.title}</h3>
              <p className="text-slate-400 text-sm mb-3">{c.desc}</p>
              <div className="flex gap-4 text-xs text-slate-400 mb-3 flex-wrap">
                <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" /> {c.rating} ({c.reviews})</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {c.hours} hrs</span>
                <span className="flex items-center gap-1"><Users size={12} /> {c.students}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <img src={c.avatar} alt={c.instructor} className="w-6 h-6 rounded-full" />
                {c.instructor} · {c.college}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-white font-bold">
                  {c.price} <del className="text-slate-500 font-normal text-sm ml-1">{c.original}</del>
                  <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded ml-2">80% off</span>
                </div>
                <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  Enroll Now
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Link href="/signup" className="inline-flex items-center gap-2 border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white font-semibold px-7 py-3 rounded-xl transition-all">
          Start Learning Today →
        </Link>
      </div>
    </section>
  );
}
