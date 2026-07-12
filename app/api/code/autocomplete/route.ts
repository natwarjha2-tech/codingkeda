import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

    // Validation
    if (!code || code.trim().length < 3) {
      return NextResponse.json({ success: true, suggestion: "" });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: true, suggestion: "" });
    }

    // Truncate code to keep tokens low (keep area around cursor)
    const lines = code.split("\n");
    const startLine = Math.max(0, (cursorLine || lines.length) - 30);
    const relevantCode = lines.slice(startLine).join("\n").slice(-2000);

    // Build prompt
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

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          stopSequences: ["\n\n\n"],
        },
      }),
    });

    if (!res.ok) {
      // Rate limit or error — return empty (no error to user)
      return NextResponse.json({ success: true, suggestion: "" });
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Clean the response — remove markdown code blocks if present
    let suggestion = rawText
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/```$/gm, "")
      .replace(/^\n/, ""); // Remove leading newline

    // Limit to max 15 lines (safety cap for very long suggestions)
    const suggestionLines = suggestion.split("\n");
    if (suggestionLines.length > 15) {
      suggestion = suggestionLines.slice(0, 15).join("\n");
    }

    return NextResponse.json({ success: true, suggestion });
  } catch {
    // Silent fail — non-critical feature
    return NextResponse.json({ success: true, suggestion: "" });
  }
}
