import { GraduationCap, Briefcase } from "lucide-react";

const founders = [
  {
    name: "Sudhanshu Shekhar Pathak",
    role: "Co-Founder",
    avatar: "https://i.pravatar.cc/160?img=11",
    education: "M.S. Ramaiah Institute of Technology",
    work: "Senior Faculty – Chemistry, Allen Career Institute",
    bio: "With years of experience shaping young minds at Allen, Sudhanshu brings a deep understanding of how students learn best. His teaching philosophy — make it simple, make it fun — is the backbone of CodingKeda's curriculum design.",
    tag: "Educator & Mentor",
    color: "from-purple-600 to-blue-600",
  },
  {
    name: "Natwar Kumar Jha",
    role: "Co-Founder",
    avatar: "https://i.pravatar.cc/160?img=33",
    education: "M.S. Ramaiah Institute of Technology – Computer Science",
    work: "Senior Architect, Volvo India Private Limited",
    bio: "A seasoned software architect with real-world industry experience at Volvo India, Natwar brings cutting-edge tech knowledge to CodingKeda. He ensures every course is aligned with what the industry actually needs.",
    tag: "Tech Architect & Builder",
    color: "from-orange-500 to-pink-600",
  },
];

export default function Founders() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20" id="founders">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Meet the <span className="gradient-text">Founders</span></h2>
        <p className="text-slate-400">Built by educators & engineers who believe every student deserves world-class tech education</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {founders.map((f) => (
          <div key={f.name} className="bg-[#16213e] border border-white/8 rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform">
            {/* Top gradient bar */}
            <div className={`h-2 bg-gradient-to-r ${f.color}`} />
            <div className="p-7">
              <div className="flex items-center gap-4 mb-5">
                <img src={f.avatar} alt={f.name} className="w-16 h-16 rounded-full border-2 border-purple-500 object-cover" />
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{f.name}</h3>
                  <span className={`text-xs font-semibold bg-gradient-to-r ${f.color} bg-clip-text text-transparent`}>{f.role}</span>
                  <div className="mt-1">
                    <span className="bg-purple-500/15 text-purple-300 text-xs px-2 py-0.5 rounded-full">{f.tag}</span>
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed mb-5">{f.bio}</p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 text-sm text-slate-300">
                  <GraduationCap size={15} className="text-purple-400 mt-0.5 shrink-0" />
                  <span>{f.education}</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-300">
                  <Briefcase size={15} className="text-orange-400 mt-0.5 shrink-0" />
                  <span>{f.work}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
