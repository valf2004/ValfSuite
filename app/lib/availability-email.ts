import nodemailer from "nodemailer";

export type AvailabilityEmail = {
  id: string;
  name: string;
  email: string;
  arrivalDate: string;
  departureDate: string;
  guestCount: number;
  message: string;
  language: string;
};

export async function sendAvailabilityNotification(data: AvailabilityEmail) {
  const config = emailConfig();
  if (!config) {
    console.warn("availability_email_skipped", "SMTP configuration is incomplete");
    return { sent: false as const, reason: "not_configured" as const };
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
  const subject = `Nuova richiesta VALF Suite · ${data.arrivalDate}–${data.departureDate}`;
  await transport.sendMail({
    from: `VALF Suite <${config.user}>`,
    to: config.recipients,
    replyTo: data.email,
    subject,
    text: textBody(data),
    html: htmlBody(data),
  });
  return { sent: true as const };
}

function emailConfig() {
  const host = process.env["SMTP_HOST"]?.trim();
  const user = process.env["SMTP_USER"]?.trim();
  const password = process.env["SMTP_APP_PASSWORD"]?.replace(/\s/g, "");
  const recipients = process.env["EMAIL_RECIPIENTS"]?.split(",").map(value => value.trim()).filter(Boolean);
  if (!host || !user || !password || !recipients?.length) return null;
  return { host, user, password, recipients, port: Number(process.env["SMTP_PORT"] || 465), secure: process.env["SMTP_SECURE"] !== "false" };
}

function textBody(data: AvailabilityEmail) {
  return [`Nuova richiesta di disponibilità`, ``, `Nome: ${data.name}`, `Email: ${data.email}`, `Arrivo: ${data.arrivalDate}`, `Partenza: ${data.departureDate}`, `Ospiti: ${data.guestCount}`, `Lingua: ${data.language.toUpperCase()}`, ``, `Messaggio:`, data.message || "—", ``, `Codice richiesta: ${data.id}`].join("\n");
}

function htmlBody(data: AvailabilityEmail) {
  return `<div style="font-family:Arial,sans-serif;color:#2f2a25;max-width:640px"><h1 style="color:#164f4a">Nuova richiesta di disponibilità</h1><table cellpadding="8" style="border-collapse:collapse"><tr><td><strong>Nome</strong></td><td>${escapeHtml(data.name)}</td></tr><tr><td><strong>Email</strong></td><td><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr><tr><td><strong>Arrivo</strong></td><td>${data.arrivalDate}</td></tr><tr><td><strong>Partenza</strong></td><td>${data.departureDate}</td></tr><tr><td><strong>Ospiti</strong></td><td>${data.guestCount}</td></tr><tr><td><strong>Lingua</strong></td><td>${escapeHtml(data.language.toUpperCase())}</td></tr></table><h2 style="font-size:18px">Messaggio</h2><p style="white-space:pre-wrap">${escapeHtml(data.message || "—")}</p><p style="color:#917a62;font-size:12px">Codice richiesta: ${data.id}</p></div>`;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!); }
