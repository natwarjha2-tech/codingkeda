import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/middleware";
import AdmZip from "adm-zip";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/admin/extract-ppt
 * 
 * Receives a .pptx file, extracts text from slides,
 * sends to Gemini AI to generate structured quiz & exercise data.
 * Returns JSON that frontend uses to display review page.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded." },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pptx")) {
      return NextResponse.json(
        { success: false, message: "Only .pptx files are supported." },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text from PPTX using ZIP XML parsing (reliable method)
    const slideText = extractPptxText(buffer);

    if (!slideText || slideText.trim().length < 20) {
      return NextResponse.json(
        { success: false, message: "Could not extract enough text from the PPT. Ensure slides have text content." },
        { status: 400 }
      );
    }

    // Check Gemini API key
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI service not configured (GEMINI_API_KEY missing)." },
        { status: 500 }
      );
    }

    // Send to Gemini AI for structured extraction
    const result = await callGeminiForExtraction(slideText);

    if (!result) {
      return NextResponse.json(
        { success: false, message: "AI could not process the content. Try again or use a different PPT." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Extracted ${result.quizzes.length} quiz(zes) and ${result.exercises.length} exercise(s).`,
      quizzes: result.quizzes,
      exercises: result.exercises,
      extractedText: slideText, // Full extracted text for DB storage
    });
  } catch (err) {
    console.error("Extract PPT error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error: " + (err instanceof Error ? err.message : "Unknown") },
      { status: 500 }
    );
  }
}

/**
 * Extract text from all slides in a .pptx file
 * PPTX is a ZIP archive containing XML files in ppt/slides/
 */
function extractPptxText(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  let allText = "";

  // Get slide XML entries sorted by slide number
  const slideEntries = entries
    .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const entry of slideEntries) {
    const xml = entry.getData().toString("utf8");
    // Extract text between <a:t> tags (PowerPoint text run nodes)
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (matches && matches.length > 0) {
      const slideNum = entry.entryName.match(/slide(\d+)/)?.[1] || "?";
      allText += `\n--- SLIDE ${slideNum} ---\n`;
      let slideContent = "";
      for (const m of matches) {
        const content = m.replace(/<[^>]+>/g, "").trim();
        if (content) slideContent += content + " ";
      }
      allText += slideContent.trim() + "\n";
    }
  }

  return allText.trim();
}

/**
 * Call Gemini AI to convert extracted PPT text into structured quiz & exercise data
 */
async function callGeminiForExtraction(
  slideText: string
): Promise<{ quizzes: any[]; exercises: any[] } | null> {
  // Truncate if too long (Gemini context limit)
  const text = slideText.length > 15000 ? slideText.slice(0, 15000) : slideText;

  const prompt = `You are an expert educational content analyzer. Given the following text extracted from a PowerPoint presentation, extract and generate:

1. QUIZ QUESTIONS (MCQ) — multiple choice questions based on the content
2. EXERCISES — coding or theory exercises based on the content

EXTRACTED PPT CONTENT:
"""
${text}
"""

RULES:
- Generate quiz questions that test understanding of the PPT content
- Each quiz must have exactly 4 options, one correct answer (0-indexed), and an explanation
- For exercises, determine if they are "theory" or "coding" type based on content
- For THEORY exercises: provide title, description (the question), solution (the correct/expected answer that will be stored for evaluation), and difficulty
- For CODING exercises: provide title, description, difficulty (easy/medium/hard), category, constraints, timeComplexity, spaceComplexity, language (default "c"), and testCases array with input and expectedOutput. Include 2 visible and 2 hidden test cases.
- Difficulty should be: easy, medium, or hard
- If content mentions programming problems with input/output, mark as coding type
- If content is conceptual/theoretical Q&A, mark as theory type
- Generate minimum 1 and maximum 10 quizzes
- Generate minimum 1 and maximum 5 exercises

Respond ONLY with valid JSON (no markdown, no code blocks, no explanation outside JSON):
{
  "quizzes": [
    {
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Because..."
    }
  ],
  "exercises": [
    {
      "title": "Exercise Title",
      "description": "Problem description or question text",
      "type": "theory",
      "difficulty": "medium",
      "solution": "Expected correct answer for theory type",
      "category": "general",
      "constraints": null,
      "timeComplexity": null,
      "spaceComplexity": null,
      "language": null,
      "testCases": []
    },
    {
      "title": "Coding Problem Title",
      "description": "Write a program that...",
      "type": "coding",
      "difficulty": "medium",
      "solution": null,
      "category": "arrays",
      "constraints": "1 <= N <= 10^5\\n-10^9 <= arr[i] <= 10^9",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "language": "c",
      "testCases": [
        { "input": "5\\n1 2 3 4 5", "expectedOutput": "15", "isHidden": false },
        { "input": "3\\n10 20 30", "expectedOutput": "60", "isHidden": false },
        { "input": "1\\n42", "expectedOutput": "42", "isHidden": true },
        { "input": "4\\n-1 -2 -3 -4", "expectedOutput": "-10", "isHidden": true }
      ]
    }
  ]
}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!rawText) {
      console.error("Gemini returned empty response");
      return null;
    }

    // Clean response — remove markdown code blocks if present
    const cleaned = rawText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    };
  } catch (err) {
    console.error("Gemini extraction failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
