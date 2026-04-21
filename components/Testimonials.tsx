const testimonials = [
  { stars: 5, text: "I went from a non-CS background to landing a ₹12 LPA job at a Bangalore startup in just 6 months. The Java Full Stack course is absolutely world-class!", name: "Ananya Reddy", role: "SDE at Razorpay · Hyderabad", img: "https://i.pravatar.cc/48?img=5" },
  { stars: 5, text: "The DSA course helped me crack interviews at Amazon and Microsoft. The problem-solving approach taught here is unmatched. Worth every rupee!", name: "Rohan Gupta", role: "SDE-2 at Amazon · Pune", img: "https://i.pravatar.cc/48?img=12", featured: true },
  { stars: 5, text: "Best investment I made in my career. The live doubt sessions and mentor support are incredible. Got placed at TCS Digital with 8 LPA package!", name: "Meera Joshi", role: "Software Engineer at TCS · Mumbai", img: "https://i.pravatar.cc/48?img=9" },
];

export default function Testimonials() {
  return (
    <section className="bg-[#1a1a2e] py-20 px-6" id="testimonials">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Student <span className="gradient-text">Success Stories</span></h2>
          <p className="text-slate-400">Real results from real learners across India</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className={`bg-[#16213e] rounded-2xl p-7 border ${t.featured ? "border-purple-500 shadow-[0_0_0_1px_#6c47ff]" : "border-white/8"}`}>
              <div className="text-yellow-400 text-lg mb-4">{"★".repeat(t.stars)}</div>
              <p className="text-slate-400 text-sm leading-relaxed italic mb-6">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <img src={t.img} alt={t.name} className="w-11 h-11 rounded-full" />
                <div>
                  <p className="font-semibold text-white text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
