"use client";
import { useState, useEffect } from "react";

const TEXT = "CodingKida";
// Match logo colors: Coding=white, K=red, i=orange, d=green, a=white
const BRAND_COLORS = [
  "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff",
  "#ef4444", "#f59e0b", "#22c55e", "#ffffff",
];

export default function BrandText() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TEXT.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-[#080810] overflow-hidden py-4 border-t border-white/5">
      <p
        className="text-center font-extrabold select-none cursor-default whitespace-nowrap px-4"
        style={{ fontSize: "clamp(3.5rem, 15.5vw, 15rem)", lineHeight: 1 }}
      >
        {TEXT.split("").map((char, i) => {
          const dist = Math.abs(i - activeIndex);
          const isLit = dist <= 2;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.3 : 0;
          const color = BRAND_COLORS[i];
          return (
            <span
              key={i}
              style={{
                color: isLit ? color : "transparent",
                opacity: isLit ? opacity : 1,
                WebkitTextStroke: `1.5px ${isLit ? color : "rgba(255,255,255,0.15)"}`,
                transition: "color 0.5s ease, opacity 0.5s ease, -webkit-text-stroke 0.5s ease",
                display: "inline-block",
              }}
            >
              {char}
            </span>
          );
        })}
      </p>
    </section>
  );
}
