import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/code/analyze-complexity
 * Analyzes user's code and returns Time/Space complexity in Big-O notation.
 * Uses Gemini AI for accurate analysis.
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

    const prompt = `Analyze the following ${language || "code"} and determine its time complexity and space complexity in Big-O notation.

CODE:
\`\`\`
${code.slice(0, 3000)}
\`\`\`

Respond ONLY with valid JSON (no markdown, no explanation):
{"timeComplexity":"O(...)","spaceComplexity":"O(...)"}

Examples: O(1), O(n), O(n²), O(n log n), O(2^n), O(n*m)
Be precise based on the actual loops, recursion, and data structures used.`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: "AI analysis failed." }, { status: 500 });
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Extract JSON from response (handles extra text, markdown, etc.)
    let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    
    // Try to extract JSON object from anywhere in the response
    const jsonMatch = cleaned.match(/\{[^{}]*"timeComplexity"[^{}]*"spaceComplexity"[^{}]*\}/);
    if (!jsonMatch) {
      // Fallback: try to find any JSON object
      const anyJson = cleaned.match(/\{[^{}]*\}/);
      if (anyJson) cleaned = anyJson[0];
    } else {
      cleaned = jsonMatch[0];
    }
    
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      timeComplexity: parsed.timeComplexity || "O(?)",
      spaceComplexity: parsed.spaceComplexity || "O(?)",
    });
  } catch (err: any) {
    console.error("Analyze complexity error:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Analysis failed." },
      { status: 500 }
    );
  }
}
