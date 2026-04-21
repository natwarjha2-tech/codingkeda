import { Star, Users } from "lucide-react";

const instructors = [
  { name: "Rahul Sharma", role: "Java & Spring Boot", college: "IIT Delhi", exp: "10+ yrs", students: "45K", rating: "4.9", img: "https://i.pravatar.cc/120?img=11" },
  { name: "Priya Nair", role: "MERN Stack", college: "Ex-Google", exp: "8 yrs", students: "32K", rating: "4.8", img: "https://i.pravatar.cc/120?img=22" },
  { name: "Amit Verma", role: "Data Science & ML", college: "Ex-Amazon", exp: "12 yrs", students: "60K", rating: "4.9", img: "https://i.pravatar.cc/120?img=33" },
  { name: "Vikram Singh", role: "DSA & Algorithms", college: "IIT Bombay", exp: "9 yrs", students: "80K", rating: "4.9", img: "https://i.pravatar.cc/120?img=44" },
];

export default function Instructors() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20" id="instructors">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Learn from the <span className="gradient-text">Best Minds</span></h2>
        <p className="text-slate-400">IIT alumni, FAANG engineers & startup founders teaching you</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {instructors.map((i) => (
          <div key={i.name} className="bg-[#16213e] border border-white/8 rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform">
            <img src={i.img} alt={i.name} className="w-20 h-20 rounded-full border-2 border-purple-500 mx-auto mb-4 object-cover" />
            <h4 className="font-bold text-white">{i.name}</h4>
            <p className="text-purple-400 text-sm font-medium mb-3">{i.role}</p>
            <div className="flex justify-center gap-2 mb-3">
              <span className="bg-white/6 text-slate-400 text-xs px-3 py-1 rounded-full">{i.college}</span>
              <span className="bg-white/6 text-slate-400 text-xs px-3 py-1 rounded-full">{i.exp}</span>
            </div>
            <div className="flex justify-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Users size={12} /> {i.students}</span>
              <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" /> {i.rating}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
