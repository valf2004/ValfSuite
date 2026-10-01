export function parseStayPrice(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^(?:\d+)(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 2147483647 ? cents : null;
}

export function paymentStatusForTotal(currentStatus, totalCents, confirmedCents) {
  if (currentStatus === "reported") return "reported";
  if (confirmedCents >= totalCents) return "paid";
  return confirmedCents > 0 ? "partial" : "unpaid";
}

export function priceChangeNote(previousCents, nextCents) {
  const currency = value => new Intl.NumberFormat("it-IT", {style:"currency", currency:"EUR"}).format(value / 100);
  return previousCents == null
    ? `Prezzo totale concordato inserito: ${currency(nextCents)}.`
    : `Prezzo totale concordato aggiornato da ${currency(previousCents)} a ${currency(nextCents)}.`;
}
