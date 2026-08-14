import { headers } from "next/headers";
import { listAvailabilityEvents, listAvailabilityRequests, updateAvailabilityQuote } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";
import { sendQuoteEmail } from "../../../lib/availability-email";

export async function POST(request: Request) {
  try {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });

  const data = await request.json().catch(() => null) as { id?: unknown; subject?: unknown; body?: unknown; price?: unknown } | null;
  if (!data || typeof data.id !== "string" || typeof data.subject !== "string" || typeof data.body !== "string" || typeof data.price !== "string") return Response.json({ message: "Preventivo non valido." }, { status: 400 });
  const subject = data.subject.trim();
  const body = data.body.trim();
  const price = data.price.trim().replace(",", ".");
  if (!subject || subject.length > 180 || !body || body.length > 6000 || !/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) return Response.json({ message: "Controlla oggetto, testo e importo del preventivo." }, { status: 400 });

  const item = (await listAvailabilityRequests()).find(row => row.id === data.id);
  if (!item) return Response.json({ message: "Richiesta non trovata." }, { status: 404 });
  const quoteAmountCents = Math.round(Number(price) * 100);
  const depositAmountCents = Math.round(quoteAmountCents * 0.3);
  const balanceAmountCents = quoteAmountCents - depositAmountCents;
  const locale = ({ it:"it-IT", en:"en-GB", fr:"fr-FR", es:"es-ES", de:"de-DE" } as Record<string,string>)[item.language] || "it-IT";
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const balanceDueDate = new Date(`${item.arrivalDate}T12:00:00Z`);
  balanceDueDate.setUTCDate(balanceDueDate.getUTCDate() - 7);
  const localizedBalanceDueDate = new Intl.DateTimeFormat(locale, { day:"numeric", month:"long", year:"numeric", timeZone:"UTC" }).format(balanceDueDate);
  const replacements:Record<string,string> = {
    "{PREZZO}": currency.format(quoteAmountCents / 100),
    "{ACCONTO}": currency.format(depositAmountCents / 100),
    "{SALDO}": currency.format(balanceAmountCents / 100),
    "{DATA_SALDO}": localizedBalanceDueDate,
  };
  const deliveredBody = Object.entries(replacements).reduce((text,[placeholder,value]) => text.replaceAll(placeholder,value),body);
  const result = await sendQuoteEmail(item.email, subject, deliveredBody);
  if (!result.sent) return Response.json({ message: "Invio email non configurato." }, { status: 503 });
  const updated = await updateAvailabilityQuote(item.id, quoteAmountCents, subject, deliveredBody, user.email);
  const event = (await listAvailabilityEvents()).filter(row=>row.requestId===item.id).at(-1);
  return Response.json({ request: updated[0], event, sentBy: user.email });
  } catch (error) {
    console.error("quote_send_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ message:"Invio del preventivo non riuscito. Verifica se l’email è stata ricevuta prima di riprovare." },{status:500});
  }
}
