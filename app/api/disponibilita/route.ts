export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data?.nome || !data?.email || !data?.arrivo || !data?.partenza || !data?.privacy) {
    return Response.json({ message: "Controlla i campi obbligatori." }, { status: 400 });
  }

  const webhook = process.env.AVAILABILITY_WEBHOOK_URL;
  if (!webhook) {
    return Response.json({ message: "Il modulo sarà attivato prima della pubblicazione." }, { status: 503 });
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, source: "valfsuite.valfservice.it", receivedAt: new Date().toISOString() }),
  });

  if (!response.ok) return Response.json({ message: "Invio non riuscito. Riprova più tardi." }, { status: 502 });
  return Response.json({ ok: true });
}
