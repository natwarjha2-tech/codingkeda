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
import { getFreeLessons } from "@/app/services/free-learning.service";
import { getPublicLiveClasses } from "@/app/services/live-public.service";
import { getPublicWeekly } from "@/app/services/weekly-public.service";
import { getSocialProof } from "@/app/services/social-proof.service";
import RoleStrip from "@/components/home/RoleStrip";
import StudentVoices from "@/components/home/StudentVoices";
import { connection } from "next/server";

// Rounded, friendly font for the kids' home page only (the rest of the site keeps Inter).
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

async function HeroWithData() {
  await connection();
  // All cached in memory (1–5 min) and each returns an empty value on error.
  const [courses, freeLessons, live, weekly, proof] = await Promise.all([
    getHomeCourses(),
    getFreeLessons(),
    getPublicLiveClasses(),
    getPublicWeekly().catch(() => null),
    getSocialProof(),
  ]);
  const stats = {
    courses: courses.length,
    lessons: courses.reduce((s, c) => s + c.lessonCount, 0),
    freeLessons: freeLessons.length,
    students: courses.reduce((s, c) => s + c.studentCount, 0),
    lessonsThisWeek: proof.lessonsThisWeek,
    avgRating: proof.avgRating,
    ratingCount: proof.ratingCount,
  };
  const next = live[0] ? { id: live[0].id, title: live[0].title, scheduledAt: live[0].scheduledAt, status: live[0].status } : null;
  return <HomeHero stats={stats} nextLive={next} weeklyTitle={weekly?.exercise?.title ?? null} />;
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

      {/* 1st screen: puzzle, class chips, free start, live pills, real numbers */}
      <Suspense fallback={<HomeHero />}>
        <HeroWithData />
      </Suspense>

      {/* Who are you? Kid / parent / school */}
      <RoleStrip />

      {/* Then the most exciting things, in order */}
      <Suspense fallback={<CoursesFallback />}>
        <HomeCourses />
      </Suspense>
      <Suspense fallback={null}>
        <StudentVoices />
      </Suspense>
      <FreeZone />
      <PlayArea />
      <LiveAndSchools />
      <LearnLoop />
      <DemoVideo />
      <ClassPicker />
      <KidsPricing />
      <ParentsSection />
      <HomeFaq />
      <AppBand />

      <BrandText />
      <Footer />
    </main>
  );
}
