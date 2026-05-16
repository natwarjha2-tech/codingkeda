import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionGuard from "@/components/SessionGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodingKeda – Learn. Code. Get Placed.",
  description: "India's #1 tech learning platform. Learn Java, Python, Web Dev, DSA & more. Join 5,00,000+ learners at CodingKeda.",
  keywords: "coding, java, python, web development, DSA, online learning, India",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className={inter.className}>
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}
