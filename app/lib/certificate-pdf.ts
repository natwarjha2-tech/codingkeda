/**
 * CodingKida course certificate (A4 landscape PDF), generated on demand with
 * pdf-lib (pure JS, no native deps). Nothing is stored on S3 — the PDF is
 * rebuilt from the Certificate row whenever the owner opens it, so the only
 * copies are the in-app view and the email attachment.
 */
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface CertificateData {
  code: string;
  studentName: string;
  courseTitle: string;
  percent: number;
  issuedAt: Date;
}

const W = 841.89; // A4 landscape (pt)
const H = 595.28;

const NAVY = rgb(0.06, 0.06, 0.16);
const PURPLE = rgb(0.424, 0.278, 1); // #6c47ff
const GOLD = rgb(0.83, 0.66, 0.26);
const INK = rgb(0.13, 0.14, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52);

let logoBytes: Uint8Array | null | undefined;
async function loadLogo(): Promise<Uint8Array | null> {
  if (logoBytes !== undefined) return logoBytes;
  try {
    logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "logo.jpg")));
  } catch {
    logoBytes = null; // certificate still renders without the logo
  }
  return logoBytes;
}

/** Keep only characters the built-in (WinAnsi) fonts can draw. */
function safeText(font: PDFFont, s: string): string {
  let out = "";
  for (const ch of s) {
    try { font.encodeText(ch); out += ch; } catch { /* drop unsupported glyph */ }
  }
  return out.trim() || "-";
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK, maxWidth = W - 160) {
  let s = size;
  const t = safeText(font, text);
  while (s > 10 && font.widthOfTextAtSize(t, s) > maxWidth) s -= 1; // shrink long titles
  const w = font.widthOfTextAtSize(t, s);
  page.drawText(t, { x: (W - w) / 2, y, size: s, font, color });
}

export async function buildCertificatePdf(d: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`CodingKida Certificate ${d.code}`);
  pdf.setAuthor("CodingKida");
  pdf.setSubject(`Certificate of Completion — ${d.courseTitle}`);
  pdf.setCreator("CodingKida");

  const page = pdf.addPage([W, H]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Background + double frame
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: NAVY, borderWidth: 6 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: GOLD, borderWidth: 1.5 });
  // Accent bars
  page.drawRectangle({ x: 32, y: H - 120, width: 10, height: 88, color: PURPLE });
  page.drawRectangle({ x: W - 42, y: 32, width: 10, height: 88, color: PURPLE });

  // Logo + brand
  const logo = await loadLogo();
  if (logo) {
    try {
      const img = await pdf.embedJpg(logo);
      const s = 58 / img.height;
      page.drawImage(img, { x: 62, y: H - 108, width: img.width * s, height: 58 });
    } catch { /* ignore a bad logo file */ }
  }
  page.drawText("CodingKida", { x: logo ? 136 : 62, y: H - 78, size: 24, font: sansBold, color: NAVY });
  page.drawText("Learn  .  Practice  .  Grow", { x: logo ? 137 : 63, y: H - 96, size: 10, font: sans, color: MUTED });

  // Certificate id (top-right)
  const idText = `Certificate ID: ${d.code}`;
  page.drawText(idText, { x: W - 62 - sans.widthOfTextAtSize(idText, 10), y: H - 78, size: 10, font: sans, color: MUTED });

  // Title
  centered(page, "CERTIFICATE OF COMPLETION", H - 175, serifBold, 34, NAVY);
  page.drawLine({ start: { x: W / 2 - 120, y: H - 190 }, end: { x: W / 2 + 120, y: H - 190 }, thickness: 1.5, color: GOLD });

  centered(page, "This is to certify that", H - 228, serif, 16, MUTED);
  centered(page, d.studentName, H - 278, serifItalic, 40, PURPLE);
  page.drawLine({ start: { x: W / 2 - 220, y: H - 290 }, end: { x: W / 2 + 220, y: H - 290 }, thickness: 0.8, color: MUTED });

  centered(page, "has successfully completed the course", H - 322, serif, 16, MUTED);
  centered(page, d.courseTitle, H - 360, serifBold, 26, NAVY);
  centered(page, `and passed the final assessment with a score of ${d.percent}%`, H - 392, serif, 15, INK);

  // Footer: date (left) · seal (middle) · signature (right)
  const issued = d.issuedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const footY = 112;
  page.drawLine({ start: { x: 110, y: footY }, end: { x: 290, y: footY }, thickness: 0.8, color: INK });
  page.drawText(issued, { x: 200 - sans.widthOfTextAtSize(issued, 12) / 2, y: footY + 8, size: 12, font: sansBold, color: INK });
  page.drawText("Date of Issue", { x: 200 - sans.widthOfTextAtSize("Date of Issue", 10) / 2, y: footY - 16, size: 10, font: sans, color: MUTED });

  page.drawCircle({ x: W / 2, y: footY + 6, size: 40, borderColor: GOLD, borderWidth: 2, color: rgb(1, 0.98, 0.92) });
  page.drawCircle({ x: W / 2, y: footY + 6, size: 32, borderColor: GOLD, borderWidth: 0.8 });
  const sealTop = "CODINGKIDA";
  const sealBottom = "CERTIFIED";
  page.drawText(sealTop, { x: W / 2 - sansBold.widthOfTextAtSize(sealTop, 9) / 2, y: footY + 10, size: 9, font: sansBold, color: NAVY });
  page.drawText(sealBottom, { x: W / 2 - sans.widthOfTextAtSize(sealBottom, 8) / 2, y: footY - 2, size: 8, font: sans, color: NAVY });

  const sigName = "CodingKida Academic Team";
  page.drawLine({ start: { x: W - 290, y: footY }, end: { x: W - 110, y: footY }, thickness: 0.8, color: INK });
  page.drawText("CodingKida", { x: W - 200 - serifItalic.widthOfTextAtSize("CodingKida", 20) / 2, y: footY + 8, size: 20, font: serifItalic, color: PURPLE });
  page.drawText(sigName, { x: W - 200 - sans.widthOfTextAtSize(sigName, 10) / 2, y: footY - 16, size: 10, font: sans, color: MUTED });

  const verify = `Verify this certificate: www.codingkida.com/api/certificates/verify?code=${d.code}`;
  centered(page, verify, 50, sans, 8.5, MUTED);

  return pdf.save();
}
