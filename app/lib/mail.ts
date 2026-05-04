import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,       // STARTTLS — correct for Gmail App Password on port 587
  requireTLS: true,    // Force TLS upgrade (security fix for CWE-319)
  family: 4,           // Force IPv4 — fixes ENETUNREACH on IPv6 networks
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: true, // Verify SSL certificate
  },
});

function sanitize(val: string): string {
  return val.replace(/[\r\n]/g, " ").trim();
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: `"CodingKeda" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log("MAIL SENT:", sanitize(info.messageId));
  } catch (err) {
    console.error("MAIL ERROR:", err instanceof Error ? sanitize(err.message) : "Unknown error");
  }
}
