import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodingKeda – Learn. Code. Get Placed.",
  description: "India's #1 tech learning platform. Learn Java, Python, Web Dev, DSA & more. Join 5,00,000+ learners at CodingKeda.",
  keywords: "coding, java, python, web development, DSA, online learning, India",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
