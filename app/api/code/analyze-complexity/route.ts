import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Use multiple models as fallback chain — if primary is unavailable, try next
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

/**
 * POST /api/code/analyze-complexity
 * Analyzes user's code and returns Time/Space complexity in Big-O notation.
 * Uses Gemini AI with retry + model fallback for reliability.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json();

    if (!code || code.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: "Code is too short to analyze." },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI service not configured." },
        { status: 500 }
      );
    }

    const prompt = `Analyze this ${language || "code"} complexity.

${code.slice(0, 2000)}

Return JSON only: {"timeComplexity":"O(...)","spaceComplexity":"O(...)"}`;

    // Try each model until one succeeds
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
              responseMimeType: "application/json",
            },
          }),
        });

        // Skip to next model if this one is unavailable/rate-limited
        if (res.status === 503 || res.status === 429) continue;
        if (!res.ok) continue;

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!rawText) continue;

        const parsed = JSON.parse(rawText.trim());
        if (parsed.timeComplexity && parsed.spaceComplexity) {
          return NextResponse.json({
            success: true,
            timeComplexity: parsed.timeComplexity,
            spaceComplexity: parsed.spaceComplexity,
          });
        }
      } catch {
        // Try next model
        continue;
      }
    }

    // All models failed — return failure
    return NextResponse.json(
      { success: false, message: "AI temporarily unavailable." },
      { status: 503 }
    );
  } catch (err: any) {
    console.error("Analyze complexity error:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Analysis failed." },
      { status: 500 }
    );
  }
}
