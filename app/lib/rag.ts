/**
 * RAG core — index study material and search it by meaning.
 *
 * Flow:
 *   indexing  :  source text -> chunks -> Gemini embeddings -> MaterialChunk rows
 *   searching :  question -> embedding -> pgvector cosine search -> top chunks
 *
 * The embedding column (vector(768)) is Unsupported in Prisma, so we read/write
 * it with raw SQL. Everything else uses the normal Prisma client.
 */

import { prisma } from "@/app/lib/prisma";
import { embedText, embedTexts, EMBED_DIM } from "@/app/lib/gemini";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { logger } from "@/app/lib/logger";

export type MaterialSourceType =
  | "lesson_notes"
  | "lesson_ppt"
  | "module_material";

export interface MatchedChunk {
  id: string;
  content: string;
  title: string;
  sourceType: string;
  sourceId: string;
  distance: number; // cosine distance (0 = identical). lower = more relevant.
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split long text into overlapping word-based chunks.
 * Overlap keeps context from being cut mid-idea at a chunk boundary.
 */
export function chunkText(
  text: string,
  chunkWords = 220,
  overlapWords = 40
): string[] {
  const clean = (text || "")
    // Postgres text columns reject NUL (0x00); strip it and other control
    // chars that PDF extraction sometimes emits.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  if (words.length <= chunkWords) {
    return isMeaningfulChunk(clean) ? [clean] : [];
  }

  const chunks: string[] = [];
  const step = Math.max(1, chunkWords - overlapWords);
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkWords).join(" ").trim();
    if (slice && isMeaningfulChunk(slice)) chunks.push(slice);
    if (i + chunkWords >= words.length) break;
  }
  return chunks;
}

/**
 * Reject chunks that carry no real learning content — e.g. page markers like
 * "-- 1 of 2 --" or a handful of stray words. These otherwise pollute search
 * results and cause weak false matches.
 */
function isMeaningfulChunk(text: string): boolean {
  // Strip page-boundary markers the PDF extractor inserts.
  const stripped = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
  const letters = (stripped.match(/[a-zA-Z]/g) || []).length;
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;
  // Needs a minimum of real words and alphabetic characters to be useful.
  return wordCount >= 12 && letters >= 40;
}

// ---------------------------------------------------------------------------
// Extracting text from a source
// ---------------------------------------------------------------------------

// pdfjs (used by pdf-parse) references a few browser globals at module load /
// render time. In Node these are undefined; for plain *text* extraction they
// are never actually exercised, so minimal stubs are enough to stop the
// "DOMMatrix is not defined" crash. Applied once, lazily.
let _pdfPolyfilled = false;
function ensurePdfGlobals() {
  if (_pdfPolyfilled) return;
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(_init?: unknown) {}
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
    };
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class {
      width: number; height: number; data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.width = w; this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class {
      constructor(_p?: unknown) {}
      addPath() {}
      moveTo() {}
      lineTo() {}
    };
  }
  _pdfPolyfilled = true;
}

/** Download a PDF from its (possibly S3) URL and extract its text. */
async function extractPdfText(fileUrl: string): Promise<string> {
  try {
    ensurePdfGlobals();
    const url = getS3KeyFromUrl(fileUrl)
      ? await getSignedFileUrlFromUrl(fileUrl, 300)
      : fileUrl;
    const res = await fetch(url);
    if (!res.ok) return "";
    const buffer = Buffer.from(await res.arrayBuffer());
    // pdf-parse v2 exposes a PDFParse class (not the old pdf(buffer) call).
    // require keeps this CommonJS module out of any Edge bundle.
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result?.text || "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (err) {
    logger.warn("rag", "pdf_extract_failed", {
      fileUrl,
      error: (err as Error)?.message,
    });
    return "";
  }
}

// ---------------------------------------------------------------------------
// Writing chunks (raw SQL — embedding is an Unsupported pgvector column)
// ---------------------------------------------------------------------------

/** Format a JS number[] as a pgvector literal: "[0.1,0.2,...]". */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Remove all chunks previously indexed for a source (so re-indexing is clean). */
export async function deleteChunksForSource(
  sourceType: MaterialSourceType,
  sourceId: string
): Promise<void> {
  await prisma.materialChunk.deleteMany({ where: { sourceType, sourceId } });
}

/**
 * Index one source: delete old chunks, chunk the text, embed, insert.
 * Returns the number of chunks stored.
 */
export async function indexSource(params: {
  sourceType: MaterialSourceType;
  sourceId: string;
  title: string;
  courseId?: string | null;
  // Provide EITHER raw text OR a pdf URL to extract from.
  text?: string;
  pdfUrl?: string;
}): Promise<number> {
  const { sourceType, sourceId, title, courseId } = params;

  let rawText = params.text || "";
  if (!rawText && params.pdfUrl) {
    rawText = await extractPdfText(params.pdfUrl);
  }

  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    logger.info("rag", "index_skip_empty", { sourceType, sourceId });
    return 0;
  }

  const embeddings = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");

  // Replace any existing chunks for this source.
  await deleteChunksForSource(sourceType, sourceId);

  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i];
    if (!emb || emb.length !== EMBED_DIM) continue;

    const id = crypto.randomUUID();
    const vecLiteral = toVectorLiteral(emb);

    // Parameterized insert; cast the vector literal with ::vector.
    await prisma.$executeRaw`
      INSERT INTO "MaterialChunk"
        ("id", "sourceType", "sourceId", "courseId", "title", "chunkIndex", "content", "embedding", "createdAt")
      VALUES
        (${id}, ${sourceType}, ${sourceId}, ${courseId ?? null}, ${title}, ${i}, ${chunks[i]}, ${vecLiteral}::vector, NOW())
    `;
    stored++;
  }

  logger.success("rag", "indexed_source", {
    sourceType,
    sourceId,
    chunks: stored,
  });
  return stored;
}

// ---------------------------------------------------------------------------
// Searching
// ---------------------------------------------------------------------------

/**
 * Find the chunks most relevant to a question using pgvector cosine distance.
 * `maxDistance` filters out weak matches so off-topic questions return nothing
 * (which is what lets the AI say "not in your study material").
 */
export async function searchChunks(
  question: string,
  opts: { topK?: number; courseId?: string | null; maxDistance?: number } = {}
): Promise<MatchedChunk[]> {
  const { topK = 5, courseId = null, maxDistance = 0.55 } = opts;

  const qEmb = await embedText(question, "RETRIEVAL_QUERY");
  if (!qEmb) return [];

  const vecLiteral = toVectorLiteral(qEmb);

  // <=> is pgvector's cosine-distance operator.
  const rows = courseId
    ? await prisma.$queryRaw<MatchedChunk[]>`
        SELECT "id", "content", "title", "sourceType", "sourceId",
               ("embedding" <=> ${vecLiteral}::vector) AS "distance"
        FROM "MaterialChunk"
        WHERE "embedding" IS NOT NULL AND "courseId" = ${courseId}
        ORDER BY "embedding" <=> ${vecLiteral}::vector
        LIMIT ${topK}
      `
    : await prisma.$queryRaw<MatchedChunk[]>`
        SELECT "id", "content", "title", "sourceType", "sourceId",
               ("embedding" <=> ${vecLiteral}::vector) AS "distance"
        FROM "MaterialChunk"
        WHERE "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${vecLiteral}::vector
        LIMIT ${topK}
      `;

  return rows.filter((r) => Number(r.distance) <= maxDistance);
}
