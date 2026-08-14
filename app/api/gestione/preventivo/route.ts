import { headers } from "next/headers";
import { listAvailabilityRequests, updateAvailabilityQuote } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";
import { sendQuoteEmail } from "../../../lib/availability-email";

export async function POST(request: Request) {
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
  const localizedPrice = new Intl.NumberFormat(item.language || "it", { style: "currency", currency: "EUR" }).format(quoteAmountCents / 100);
  const deliveredBody = body.replaceAll("{PREZZO}", localizedPrice);
  const result = await sendQuoteEmail(item.email, subject, deliveredBody);
  if (!result.sent) return Response.json({ message: "Invio email non configurato." }, { status: 503 });
  const updated = await updateAvailabilityQuote(item.id, quoteAmountCents, subject, deliveredBody);
  return Response.json({ request: updated[0], sentBy: user.email });
}
