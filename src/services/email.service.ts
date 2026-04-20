import nodemailer from "nodemailer";
import { env } from "../config/env";
import type { InternRecord } from "../types/models";

function createTransporter() {
  if (!env.smtpHost) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth:
      env.smtpUser && env.smtpPass
        ? {
            user: env.smtpUser,
            pass: env.smtpPass
          }
        : undefined
  });
}

export async function sendOfferLetterEmail(input: {
  to: string;
  intern: InternRecord;
  attachmentPath?: string;
  attachmentBuffer?: Buffer;
  attachmentFilename?: string;
}) {
  const transporter = createTransporter();
  const filename = input.attachmentFilename ?? `${input.intern.referenceId}-offer-letter.pdf`;

  if (!input.attachmentBuffer && !input.attachmentPath) {
    throw new Error("Offer letter attachment is required.");
  }

  return transporter.sendMail({
    from: env.smtpFrom,
    to: input.to,
    subject: `LUMENTIX Offer Letter - ${input.intern.name}`,
    text: `Dear ${input.intern.name},\n\nPlease find your offer letter attached. For background verification, please contact bgv@lumentix.in with reference ${input.intern.referenceId}.\n\nRegards,\nHR Manager\nhr@lumentix.in\nLUMENTIX SOLUTIONS PRIVATE LIMITED`,
    attachments: [
      {
        filename,
        ...(input.attachmentBuffer ? { content: input.attachmentBuffer } : { path: input.attachmentPath }),
        contentType: "application/pdf"
      }
    ]
  });
}
