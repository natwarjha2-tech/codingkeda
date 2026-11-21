import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import CourseBrowser from "@/components/site/CourseBrowser";
import { getHomeCourses } from "@/app/services/home.service";

export const metadata: Metadata = {
  title: "All coding courses for school kids | CodingKida",
  description: "Python, Java, C, AI, Robotics and more. Video lessons, quizzes, coding exercises and certificates for Class 4 to 12.",
  alternates: { canonical: "/courses" },
};

async function Courses() {
  await connection();
  const courses = await getHomeCourses();
  return <CourseBrowser courses={courses} />;
}

export default function CoursesPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="📚 Course library"
        title={<>Find your next <span className="text-[#7C3AED]">coding adventure</span></>}
        text="Every course has short videos, quizzes after each lesson, real coding exercises and a certificate at the end."
      />
      <Suspense fallback={<div className="max-w-7xl mx-auto px-5 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-[28px] bg-[#F3F0FF] animate-pulse" />)}</div>}>
        <Courses />
      </Suspense>
    </KidsPage>
  );
}
