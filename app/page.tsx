import { Suspense } from "react";
import { Nunito } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BrandText from "@/components/BrandText";
import ScrollToHash from "@/components/ScrollToHash";
import DemoVideo from "@/components/DemoVideo";
import HomeHero from "@/components/home/HomeHero";
import ClassPicker from "@/components/home/ClassPicker";
import HomeCourses from "@/components/home/HomeCourses";
import LearnLoop from "@/components/home/LearnLoop";
import KidsPricing from "@/components/home/KidsPricing";
import ParentsSection from "@/components/home/ParentsSection";
import HomeFaq from "@/components/home/HomeFaq";
import AppBand from "@/components/home/AppBand";
import FreeZone from "@/components/home/FreeZone";
import PlayArea from "@/components/home/PlayArea";
import LiveAndSchools from "@/components/home/LiveAndSchools";
import { getHomeCourses } from "@/app/services/home.service";
import { connection } from "next/server";

// Rounded, friendly font for the kids' home page only (the rest of the site keeps Inter).
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

async function HeroWithCount() {
  await connection();
  const courses = await getHomeCourses();
  return <HomeHero courseCount={courses.length} />;
}

function CoursesFallback() {
  return (
    <section id="courses" className="px-5 py-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-[28px] bg-[#F3F0FF] animate-pulse" />)}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className={`${nunito.className} bg-[#FFFBF5] text-[#1E1B4B]`}>
      <Navbar />
      <ScrollToHash />

      <Suspense fallback={<HomeHero courseCount={0} />}>
        <HeroWithCount />
      </Suspense>

      <PlayArea />

      <ClassPicker />

      <Suspense fallback={<CoursesFallback />}>
        <HomeCourses />
      </Suspense>

      <FreeZone />

      <LearnLoop />
      <DemoVideo />
      <LiveAndSchools />
      <KidsPricing />
      <ParentsSection />
      <HomeFaq />
      <AppBand />

      <BrandText />
      <Footer />
    </main>
  );
}
