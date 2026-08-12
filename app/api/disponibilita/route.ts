import { getDb } from "../../../db";
import { availabilityRequests } from "../../../db/schema";
import { sendAvailabilityNotification } from "../../lib/availability-email";

const languages = new Set(["it", "en", "fr", "es", "de"]);
const successMessage: Record<string, string> = {
  it: "Richiesta ricevuta. Angela ti risponderà personalmente.",
  en: "Request received. Angela will reply personally.",
  fr: "Demande reçue. Angela vous répondra personnellement.",
  es: "Solicitud recibida. Angela responderá personalmente.",
  de: "Anfrage erhalten. Angela wird Ihnen persönlich antworten.",
};

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 20_000) return reply("Richiesta troppo grande.", 413);
    const data = await request.json().catch(() => null);
    if (!data || typeof data !== "object") return reply("Richiesta non valida.", 400);
    if (typeof data.website === "string" && data.website.trim()) return Response.json({ ok: true }, { status: 201 });

    const name = clean(data.nome, 120);
    const email = clean(data.email, 254).toLowerCase();
    const arrivalDate = clean(data.arrivo, 10);
    const departureDate = clean(data.partenza, 10);
    const guestCount = Number(data.ospiti);
    const message = clean(data.messaggio, 2_000);
    const language = languages.has(data.lingua) ? data.lingua : "it";

    if (!name || !isEmail(email) || !isIsoDate(arrivalDate) || !isIsoDate(departureDate) || !data.privacy) return reply("Controlla i campi obbligatori.", 400);
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 4) return reply("Il numero di ospiti deve essere compreso tra 1 e 4.", 400);
    const today = localIsoDate(new Date());
    if (arrivalDate < today) return reply("La data di arrivo non può essere nel passato.", 400);
    if (departureDate <= arrivalDate) return reply("La partenza deve essere successiva all’arrivo.", 400);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await getDb().insert(availabilityRequests).values({ id, name, email, arrivalDate, departureDate, guestCount, message, language, privacyAcceptedAt: now, createdAt: now, updatedAt: now });
    await sendAvailabilityNotification({ id, name, email, arrivalDate, departureDate, guestCount, message, language }).catch(error => {
      console.error("availability_email_failed", error instanceof Error ? error.message : "unknown");
    });
    return Response.json({ ok: true, requestId: id, message: successMessage[language] }, { status: 201 });
  } catch (error) {
    console.error("availability_request_failed", error instanceof Error ? error.message : "unknown");
    return reply("Invio non riuscito. Riprova più tardi.", 500);
  }
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function isIsoDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date=new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value; }
function localIsoDate(date: Date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function reply(message: string, status: number) { return Response.json({ message }, { status }); }
