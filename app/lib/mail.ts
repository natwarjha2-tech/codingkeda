import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
} as nodemailer.TransportOptions);

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
