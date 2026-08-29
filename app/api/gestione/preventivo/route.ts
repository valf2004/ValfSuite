import { headers } from "next/headers";
import { listAvailabilityEvents, listAvailabilityRequests, recordSentQuote } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";
import { sendQuoteEmail } from "../../../lib/availability-email";
import { createPaymentToken, hashPaymentToken } from "../../../lib/payment-token";

export async function POST(request: Request) {
  try {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });

  const data = await request.json().catch(() => null) as { id?: unknown; subject?: unknown; body?: unknown; price?: unknown; requestedPayment?:unknown } | null;
  if (!data || typeof data.id !== "string" || typeof data.subject !== "string" || typeof data.body !== "string" || typeof data.price !== "string" || typeof data.requestedPayment !== "string") return Response.json({ message: "Preventivo non valido." }, { status: 400 });
  const subject = data.subject.trim();
  const body = data.body.trim();
  const price = data.price.trim().replace(",", ".");
  const requestedPayment = data.requestedPayment.trim().replace(",", ".");
  if (!subject || subject.length > 180 || !body || body.length > 6000 || !/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !/^\d+(\.\d{1,2})?$/.test(requestedPayment) || Number(requestedPayment) <= 0) return Response.json({ message: "Controlla oggetto, testo e importo del preventivo." }, { status: 400 });

  const item = (await listAvailabilityRequests()).find(row => row.id === data.id);
  if (!item) return Response.json({ message: "Richiesta non trovata." }, { status: 404 });
  const quoteId=crypto.randomUUID();
  const paymentToken=createPaymentToken();
  const paymentTokenHash=await hashPaymentToken(paymentToken);
  const forwardedHost=requestHeaders.get("x-forwarded-host")||requestHeaders.get("host")||new URL(request.url).host;
  const forwardedProtocol=requestHeaders.get("x-forwarded-proto")||new URL(request.url).protocol.replace(":","");
  const publicBaseUrl=process.env["PUBLIC_BASE_URL"]?.trim().replace(/\/$/,"")||`${forwardedProtocol}://${forwardedHost}`;
  const paymentUrl=`${publicBaseUrl}/pagamento/${paymentToken}`;
  const quoteAmountCents = Math.round(Number(price) * 100);
  const requestedPaymentCents = Math.round(Number(requestedPayment) * 100);
  if(requestedPaymentCents>quoteAmountCents)return Response.json({message:"L’importo richiesto non può superare il totale del preventivo."},{status:400});
  const balanceAmountCents = quoteAmountCents - requestedPaymentCents;
  const locale = ({ it:"it-IT", en:"en-GB", fr:"fr-FR", es:"es-ES", de:"de-DE" } as Record<string,string>)[item.language] || "it-IT";
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const balanceDueDate = new Date(`${item.arrivalDate}T12:00:00Z`);
  balanceDueDate.setUTCDate(balanceDueDate.getUTCDate() - 7);
  const localizedBalanceDueDate = new Intl.DateTimeFormat(locale, { day:"numeric", month:"long", year:"numeric", timeZone:"UTC" }).format(balanceDueDate);
  const paymentConditions:Record<string,string>=requestedPaymentCents===quoteAmountCents?{it:`Per confermare la prenotazione è richiesto il pagamento dell’intero importo, pari a ${currency.format(requestedPaymentCents/100)}.`,en:`To confirm the booking, full payment of ${currency.format(requestedPaymentCents/100)} is required.`,fr:`Pour confirmer la réservation, le paiement intégral de ${currency.format(requestedPaymentCents/100)} est demandé.`,es:`Para confirmar la reserva, se requiere el pago completo de ${currency.format(requestedPaymentCents/100)}.`,de:`Zur Bestätigung der Buchung ist die vollständige Zahlung von ${currency.format(requestedPaymentCents/100)} erforderlich.`}:{it:`Per confermare la prenotazione è richiesto un primo pagamento di ${currency.format(requestedPaymentCents/100)}. Il saldo residuo di ${currency.format(balanceAmountCents/100)} dovrà essere versato entro il ${localizedBalanceDueDate}.`,en:`To confirm the booking, an initial payment of ${currency.format(requestedPaymentCents/100)} is required. The remaining balance of ${currency.format(balanceAmountCents/100)} must be paid by ${localizedBalanceDueDate}.`,fr:`Pour confirmer la réservation, un premier paiement de ${currency.format(requestedPaymentCents/100)} est demandé. Le solde de ${currency.format(balanceAmountCents/100)} devra être réglé au plus tard le ${localizedBalanceDueDate}.`,es:`Para confirmar la reserva, se requiere un primer pago de ${currency.format(requestedPaymentCents/100)}. El saldo restante de ${currency.format(balanceAmountCents/100)} deberá abonarse antes del ${localizedBalanceDueDate}.`,de:`Zur Bestätigung der Buchung ist eine erste Zahlung von ${currency.format(requestedPaymentCents/100)} erforderlich. Der Restbetrag von ${currency.format(balanceAmountCents/100)} ist bis zum ${localizedBalanceDueDate} zu zahlen.`};
  const replacements:Record<string,string> = {
    "{PREZZO}": currency.format(quoteAmountCents / 100),
    "{ACCONTO}": currency.format(requestedPaymentCents / 100),
    "{IMPORTO_RICHIESTO}": currency.format(requestedPaymentCents / 100),
    "{CONDIZIONI_PAGAMENTO}": paymentConditions[item.language]||paymentConditions.it,
    "{SALDO}": currency.format(balanceAmountCents / 100),
    "{DATA_SALDO}": localizedBalanceDueDate,
    "{LINK_PAGAMENTO}": paymentUrl,
  };
  const deliveredBody = Object.entries(replacements).reduce((text,[placeholder,value]) => text.replaceAll(placeholder,value),body);
  const actionLabel=({it:"Conferma e comunica il pagamento",en:"Confirm and report payment",fr:"Confirmer et signaler le paiement",es:"Confirmar y comunicar el pago",de:"Bestätigen und Zahlung mitteilen"} as Record<string,string>)[item.language]||"Conferma e comunica il pagamento";
  const result = await sendQuoteEmail(item.email, subject, deliveredBody, paymentUrl, actionLabel);
  if (!result.sent) return Response.json({ message: "Invio email non configurato." }, { status: 503 });
  const updated = await recordSentQuote({id:quoteId,requestId:item.id,amountCents:quoteAmountCents,requestedPaymentCents,subject,body:deliveredBody,tokenHash:paymentTokenHash,actorEmail:user.email});
  const event = (await listAvailabilityEvents()).filter(row=>row.requestId===item.id).at(-1);
  return Response.json({ request: updated[0], event, sentBy: user.email });
  } catch (error) {
    console.error("quote_send_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ message:"Invio del preventivo non riuscito. Verifica se l’email è stata ricevuta prima di riprovare." },{status:500});
  }
}
