"use client";
import { useState } from "react";

const TEXT = "CodingKeda";
const COLORS = [
  "#7c3aed","#8b35e8","#9a30e3","#a92bde","#b826d9",
  "#c721d4","#d41cbf","#e117aa","#ec4899","#f472b6",
];

function getOpacity(i: number, hovered: number | null): number {
  if (hovered === null) return 0;
  const dist = Math.abs(i - hovered);
  if (dist === 0) return 1;
  if (dist === 1) return 0.5;
  if (dist === 2) return 0.2;
  return 0;
}

export default function BrandText() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="bg-[#080810] overflow-hidden py-4 border-t border-white/5">
      <p
        className="text-center font-extrabold select-none cursor-default whitespace-nowrap px-4"
        style={{ fontSize: "clamp(3.5rem, 15.5vw, 15rem)", lineHeight: 1 }}
      >
        {TEXT.split("").map((char, i) => {
          const opacity = getOpacity(i, hovered);
          const color = COLORS[i];
          const isLit = opacity > 0;
          return (
            <span
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                color: isLit ? color : "transparent",
                opacity: isLit ? opacity : 1,
                WebkitTextStroke: `1.5px ${isLit ? color : "rgba(255,255,255,0.15)"}`,
                transition: "color 0.9s ease, opacity 0.9s ease, -webkit-text-stroke 0.9s ease",
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
