import { NextRequest } from "next/server";
import { apiSuccess } from "@/app/lib/response";
import { callGemini, isGeminiConfigured } from "@/app/lib/gemini";

/**
 * POST /api/code/autocomplete
 * 
 * AI inline code completion — returns a short suggestion (2-3 lines max)
 * based on current code, cursor position, language, and problem context.
 * Used by Monaco InlineCompletionsProvider in the desktop code editor.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, language, cursorLine, problemTitle, problemDesc } = await req.json();

    if (!code || code.trim().length < 3 || !isGeminiConfigured()) {
      return apiSuccess({ suggestion: "" });
    }

    // Truncate code to keep tokens low (keep area around cursor)
    const lines = code.split("\n");
    const startLine = Math.max(0, (cursorLine || lines.length) - 30);
    const relevantCode = lines.slice(startLine).join("\n").slice(-2000);

    const langLabel = language || "code";
    const problemContext = problemTitle
      ? `\nProblem: ${problemTitle}${problemDesc ? " — " + problemDesc.slice(0, 150) : ""}`
      : "";

    const prompt = `You are an inline code autocomplete engine (like GitHub Copilot).
Complete the code at the END. Return ONLY the completion text that comes AFTER the last character.
${problemContext}
Language: ${langLabel}

RULES:
- Complete the current LOGICAL BLOCK fully — if user is writing a for loop, return the ENTIRE loop (condition + body + closing brace). If it's an if-else, return the complete if-else block. If it's a function, return the full function body.
- The user should be able to accept your suggestion in ONE Tab press and get a complete, working block
- Do NOT repeat any code that is already written
- Do NOT add explanations, comments about what you're doing, or markdown
- Return ONLY raw code that continues from where the code ends
- If the code looks complete or you cannot suggest anything useful, return empty string
- Match the existing code style (indentation, naming conventions)
- Keep suggestions concise but logically complete (no half-written loops or unclosed braces)

Code so far:
${relevantCode}`;

    const rawText = await callGemini(prompt, { temperature: 0.2, maxOutputTokens: 512 });

    // Clean the response
    let suggestion = rawText
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/```$/gm, "")
      .replace(/^\n/, "");

    // Limit to max 15 lines
    const suggestionLines = suggestion.split("\n");
    if (suggestionLines.length > 15) {
      suggestion = suggestionLines.slice(0, 15).join("\n");
    }

    return apiSuccess({ suggestion });
  } catch {
    return apiSuccess({ suggestion: "" });
  }
}
