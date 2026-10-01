export function parseStayPrice(value: unknown): number | null;
export function paymentStatusForTotal(currentStatus: "unpaid" | "reported" | "partial" | "paid", totalCents: number, confirmedCents: number): "unpaid" | "reported" | "partial" | "paid";
export function priceChangeNote(previousCents: number | null, nextCents: number): string;
