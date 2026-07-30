import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";

/**
 * POST /api/code/analyze-complexity
 * Analyzes user's code and returns Time/Space complexity in Big-O notation.
 * Uses centralized Gemini client with retry + model fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json();

    if (!code || code.trim().length < 10) return apiError(400, "Code is too short to analyze.");
    if (!isGeminiConfigured()) return apiError(503, "AI service not configured.");

    const prompt = `Analyze this ${language || "code"} complexity.\n\n${code.slice(0, 2000)}\n\nReturn JSON only: {"timeComplexity":"O(...)","spaceComplexity":"O(...)"}`;

    const result = await callGeminiJSON<{ timeComplexity: string; spaceComplexity: string }>(prompt, {
      temperature: 0.1,
      maxOutputTokens: 100,
      responseMimeType: "application/json",
    });

    if (result?.timeComplexity && result?.spaceComplexity) {
      return apiSuccess({ timeComplexity: result.timeComplexity, spaceComplexity: result.spaceComplexity });
    }

    return apiError(503, "AI temporarily unavailable.");
  } catch {
    return apiError(500, "Analysis failed.");
  }
}
