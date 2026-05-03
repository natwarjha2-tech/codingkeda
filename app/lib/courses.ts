export type Course = {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  tags: string[];
};

export const COURSES: Course[] = [
  {
    id: "web-fundamentals",
    title: "Web Development Fundamentals",
    description: "HTML, CSS & JavaScript from scratch — perfect for absolute beginners.",
    level: "beginner",
    tags: ["web", "html", "css", "javascript", "beginner"],
  },
  {
    id: "react-nextjs",
    title: "React & Next.js Mastery",
    description: "Build production-grade full-stack apps with React 19 and Next.js.",
    level: "intermediate",
    tags: ["web", "react", "nextjs", "frontend", "intermediate"],
  },
  {
    id: "backend-nodejs",
    title: "Backend Engineering with Node.js",
    description: "REST APIs, databases, auth, and deployment with Node.js & Express.",
    level: "intermediate",
    tags: ["backend", "nodejs", "api", "database", "intermediate"],
  },
  {
    id: "fullstack-pro",
    title: "Full-Stack Pro Bootcamp",
    description: "End-to-end full-stack development: frontend, backend, DevOps.",
    level: "advanced",
    tags: ["fullstack", "advanced", "devops", "web"],
  },
  {
    id: "data-science",
    title: "Data Science & ML Essentials",
    description: "Python, pandas, scikit-learn — go from data to insights.",
    level: "intermediate",
    tags: ["data", "python", "ml", "ai", "intermediate"],
  },
];

/**
 * Rule-based recommendation engine.
 * answers shape: { goal?: string; experience?: string; interest?: string }
 */
export function recommendCourse(answers: Record<string, string>): Course {
  const { goal = "", experience = "", interest = "" } = answers;
  const ctx = `${goal} ${experience} ${interest}`.toLowerCase();

  if (ctx.includes("data") || ctx.includes("ml") || ctx.includes("ai") || ctx.includes("python")) {
    return COURSES.find((c) => c.id === "data-science")!;
  }
  if (ctx.includes("fullstack") || ctx.includes("full stack") || ctx.includes("advanced")) {
    return COURSES.find((c) => c.id === "fullstack-pro")!;
  }
  if (ctx.includes("backend") || ctx.includes("api") || ctx.includes("server") || ctx.includes("node")) {
    return COURSES.find((c) => c.id === "backend-nodejs")!;
  }
  if (ctx.includes("react") || ctx.includes("next") || ctx.includes("frontend") || ctx.includes("intermediate")) {
    return COURSES.find((c) => c.id === "react-nextjs")!;
  }
  // default → beginner web track
  return COURSES.find((c) => c.id === "web-fundamentals")!;
}
