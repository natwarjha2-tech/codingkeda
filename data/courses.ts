export type Course = {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  desc: string;
  slug: string; // used for payment redirect
};

// Add new courses here — automatically works in search
const COURSES: Course[] = [
  {
    id: "zenz",
    name: "ZenZ",
    tag: "For Class 4–8",
    emoji: "🌟",
    desc: "Scratch & Python basics, games, animations, and more.",
    slug: "ZenZ Package",
  },
  {
    id: "zenalpha",
    name: "ZenAlpha",
    tag: "For Class 9–12",
    emoji: "⚡",
    desc: "DSA, web & app development, career-ready skills.",
    slug: "ZenAlpha Package",
  },
];

export default COURSES;
