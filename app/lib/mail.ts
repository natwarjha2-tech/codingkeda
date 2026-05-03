import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    console.log("📨 Sending mail to:", to);

    const info = await transporter.sendMail({
      from: `"CodingKeda" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ MAIL SENT:", info.messageId);
  } catch (err) {
    console.error("❌ MAIL ERROR:", err);
  }
}