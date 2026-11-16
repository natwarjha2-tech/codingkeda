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

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** `attachments` is optional — existing callers are unchanged. */
export async function sendEmail(to: string, subject: string, html: string, attachments?: MailAttachment[]): Promise<void> {
  await sendEmailChecked(to, subject, html, attachments);
}

/** Same as sendEmail, but tells the caller whether the message was accepted by the mail server. */
export async function sendEmailChecked(to: string, subject: string, html: string, attachments?: MailAttachment[]): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"CodingKida" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
    });
    console.log("MAIL SENT:", sanitize(info.messageId));
    return true;
  } catch (err) {
    console.error("MAIL ERROR:", err instanceof Error ? sanitize(err.message) : "Unknown error");
    return false;
  }
}
