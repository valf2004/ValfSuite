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

export async function sendQuoteEmail(to: string, subject: string, body: string) {
  const config = emailConfig();
  if (!config) return { sent: false as const, reason: "not_configured" as const };
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } });
  await transport.sendMail({
    from: `VALF Suite <${config.user}>`,
    to,
    replyTo: config.user,
    subject,
    text: body,
    html: `<div style="font-family:Arial,sans-serif;color:#2f2a25;max-width:640px;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</div>`,
  });
  return { sent: true as const };
}

export async function sendAvailabilityConfirmation(data: AvailabilityEmail) {
  const config = emailConfig();
  if (!config) return { sent: false as const, reason: "not_configured" as const };
  const copy = confirmationCopy(data);
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } });
  await transport.sendMail({
    from: `VALF Suite <${config.user}>`,
    to: data.email,
    replyTo: config.user,
    subject: copy.subject,
    text: copy.body,
    html: `<div style="font-family:Arial,sans-serif;color:#2f2a25;max-width:640px;line-height:1.6;white-space:pre-wrap"><h1 style="color:#164f4a;font-size:26px">${escapeHtml(copy.heading)}</h1>${escapeHtml(copy.body).replace(/\n/g,"<br>")}</div>`,
  });
  return { sent: true as const };
}

function confirmationCopy(data: AvailabilityEmail) {
  const locale = ({it:"it-IT",en:"en-GB",fr:"fr-FR",es:"es-ES",de:"de-DE"} as Record<string,string>)[data.language] || "it-IT";
  const date = (value:string) => new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
  const values = { name:data.name, arrival:date(data.arrivalDate), departure:date(data.departureDate), guests:data.guestCount, id:data.id };
  const copies:Record<string,{subject:string;heading:string;body:string}> = {
    it:{subject:"Abbiamo ricevuto la tua richiesta · VALF Suite",heading:"Richiesta ricevuta",body:`Gentile ${values.name},\n\nabbiamo ricevuto correttamente la tua richiesta di disponibilità per VALF Suite.\n\nArrivo: ${values.arrival}\nPartenza: ${values.departure}\nOspiti: ${values.guests}\n\nAngela verificherà la disponibilità e ti risponderà personalmente con una proposta. Questa email conferma la ricezione della richiesta, ma non costituisce ancora una prenotazione.\n\nCodice richiesta: ${values.id}\n\nUn cordiale saluto,\nAngela · VALF Suite`},
    en:{subject:"We received your request · VALF Suite",heading:"Request received",body:`Dear ${values.name},\n\nwe have successfully received your availability request for VALF Suite.\n\nArrival: ${values.arrival}\nDeparture: ${values.departure}\nGuests: ${values.guests}\n\nAngela will check availability and reply personally with a proposal. This email confirms receipt of your request, but it is not yet a booking confirmation.\n\nRequest reference: ${values.id}\n\nKind regards,\nAngela · VALF Suite`},
    fr:{subject:"Nous avons reçu votre demande · VALF Suite",heading:"Demande reçue",body:`Bonjour ${values.name},\n\nnous avons bien reçu votre demande de disponibilité pour VALF Suite.\n\nArrivée : ${values.arrival}\nDépart : ${values.departure}\nVoyageurs : ${values.guests}\n\nAngela vérifiera les disponibilités et vous répondra personnellement avec une proposition. Cet e-mail confirme la réception de votre demande, mais ne constitue pas encore une confirmation de réservation.\n\nRéférence de la demande : ${values.id}\n\nCordialement,\nAngela · VALF Suite`},
    es:{subject:"Hemos recibido tu solicitud · VALF Suite",heading:"Solicitud recibida",body:`Hola ${values.name},\n\nhemos recibido correctamente tu solicitud de disponibilidad para VALF Suite.\n\nLlegada: ${values.arrival}\nSalida: ${values.departure}\nHuéspedes: ${values.guests}\n\nAngela comprobará la disponibilidad y responderá personalmente con una propuesta. Este correo confirma la recepción de la solicitud, pero todavía no constituye una reserva confirmada.\n\nReferencia de la solicitud: ${values.id}\n\nUn cordial saludo,\nAngela · VALF Suite`},
    de:{subject:"Wir haben Ihre Anfrage erhalten · VALF Suite",heading:"Anfrage erhalten",body:`Guten Tag ${values.name},\n\nwir haben Ihre Verfügbarkeitsanfrage für die VALF Suite erfolgreich erhalten.\n\nAnreise: ${values.arrival}\nAbreise: ${values.departure}\nGäste: ${values.guests}\n\nAngela prüft die Verfügbarkeit und antwortet Ihnen persönlich mit einem Angebot. Diese E-Mail bestätigt den Eingang Ihrer Anfrage, ist jedoch noch keine Buchungsbestätigung.\n\nAnfragenummer: ${values.id}\n\nMit freundlichen Grüßen,\nAngela · VALF Suite`},
  };
  return copies[data.language] || copies.it;
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
