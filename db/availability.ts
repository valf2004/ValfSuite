import { and, asc, desc, eq } from "drizzle-orm";
import { availabilityEvents, availabilityQuotes, availabilityRequests, paymentSubmissions } from "./schema";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "payment_reported" | "accepted" | "checked_in" | "police_registered" | "archived";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type PaymentMethod = "bank_transfer" | "paypal";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;
export type AvailabilityEvent = typeof availabilityEvents.$inferSelect;
type NewAvailabilityEvent = Pick<AvailabilityEvent,"requestId"|"eventType"|"createdAt"> & Partial<Omit<AvailabilityEvent,"id"|"requestId"|"eventType"|"createdAt">> & { id?:string };
export type PublicQuote = { quoteId:string; requestId:string; name:string; email:string; arrivalDate:string; departureDate:string; guestCount:number; language:string; amountCents:number; status:AvailabilityStatus };
export type SentQuote = { id:string; requestId:string; amountCents:number; subject:string; body:string; tokenHash:string; actorEmail?:string };
export type PaymentSubmissionInput = { id:string; quoteId:string; requestId:string; method:PaymentMethod; paidAmountCents:number; paidAt:string; paymentReference:string; message:string; receiptKey:string|null; receiptName:string|null; receiptContentType:string|null; receiptSize:number|null; createdAt:string };

const usesPostgres=()=>Boolean(process.env["DATABASE_URL"]?.trim());
const postgresRepository=()=>import("./availability.postgres");

export async function createAvailabilityRequest(record:NewAvailabilityRecord){
  if(usesPostgres())return (await postgresRepository()).createAvailabilityRequest(record);
  const {getDb}=await import(".");return getDb().insert(availabilityRequests).values(record);
}

export async function listAvailabilityRequests(status?:AvailabilityStatus){
  if(usesPostgres())return (await postgresRepository()).listAvailabilityRequests(status);
  const {getDb}=await import(".");const db=getDb();const today=new Date().toISOString().slice(0,10);
  const completed=await db.select().from(availabilityRequests).where(eq(availabilityRequests.status,"police_registered"));
  await Promise.all(completed.filter(item=>item.departureDate<today).map(item=>db.update(availabilityRequests).set({status:"archived",archiveOutcome:"completed",updatedAt:new Date().toISOString()}).where(eq(availabilityRequests.id,item.id))));
  return status?db.select().from(availabilityRequests).where(eq(availabilityRequests.status,status)).orderBy(desc(availabilityRequests.createdAt)):db.select().from(availabilityRequests).orderBy(desc(availabilityRequests.createdAt));
}

export async function updateAvailabilityStatus(id:string,status:AvailabilityStatus,archiveOutcome:ArchiveOutcome|null=null,actorEmail?:string,note?:string){
  if(usesPostgres())return (await postgresRepository()).updateAvailabilityStatus(id,status,archiveOutcome,actorEmail,note);
  const {getDb}=await import(".");const db=getDb();const current=await db.select().from(availabilityRequests).where(eq(availabilityRequests.id,id));const updatedAt=new Date().toISOString();
  const updated=await db.update(availabilityRequests).set({status,archiveOutcome,updatedAt}).where(eq(availabilityRequests.id,id)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId:id,eventType:"status_changed",fromStatus:current[0]?.status??null,toStatus:status,actorEmail:actorEmail??null,note:note?.trim()||null,createdAt:updatedAt});
  return updated;
}

export async function recordSentQuote(quote:SentQuote){
  if(usesPostgres())return (await postgresRepository()).recordSentQuote(quote);
  const {getDb}=await import(".");const db=getDb();const createdAt=new Date().toISOString();
  await db.update(availabilityQuotes).set({active:false}).where(eq(availabilityQuotes.requestId,quote.requestId));
  await db.insert(availabilityQuotes).values({id:quote.id,requestId:quote.requestId,amountCents:quote.amountCents,subject:quote.subject,body:quote.body,tokenHash:quote.tokenHash,active:true,createdAt});
  const updated=await db.update(availabilityRequests).set({status:"quote_sent",archiveOutcome:null,quoteAmountCents:quote.amountCents,quoteSubject:quote.subject,quoteBody:quote.body,quoteSentAt:createdAt,updatedAt:createdAt}).where(eq(availabilityRequests.id,quote.requestId)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId:quote.requestId,eventType:"email_sent",toStatus:"quote_sent",actorEmail:quote.actorEmail??null,note:"Preventivo inviato al cliente",subject:quote.subject,body:quote.body,amountCents:quote.amountCents,createdAt});
  return updated;
}

export async function findActiveQuoteByTokenHash(tokenHash:string):Promise<PublicQuote|null>{
  if(usesPostgres())return (await postgresRepository()).findActiveQuoteByTokenHash(tokenHash);
  const {getDb}=await import(".");const rows=await getDb().select({quoteId:availabilityQuotes.id,requestId:availabilityQuotes.requestId,amountCents:availabilityQuotes.amountCents,name:availabilityRequests.name,email:availabilityRequests.email,arrivalDate:availabilityRequests.arrivalDate,departureDate:availabilityRequests.departureDate,guestCount:availabilityRequests.guestCount,language:availabilityRequests.language,status:availabilityRequests.status}).from(availabilityQuotes).innerJoin(availabilityRequests,eq(availabilityQuotes.requestId,availabilityRequests.id)).where(and(eq(availabilityQuotes.tokenHash,tokenHash),eq(availabilityQuotes.active,true))).limit(1);
  return rows[0]??null;
}

export async function createPaymentSubmission(input:PaymentSubmissionInput){
  if(usesPostgres())return (await postgresRepository()).createPaymentSubmission(input);
  const {getDb}=await import(".");const db=getDb();const current=await db.select().from(availabilityRequests).where(eq(availabilityRequests.id,input.requestId));
  await db.insert(paymentSubmissions).values(input);
  const updated=await db.update(availabilityRequests).set({status:"payment_reported",archiveOutcome:null,updatedAt:input.createdAt}).where(eq(availabilityRequests.id,input.requestId)).returning();
  const methodLabel=input.method==="paypal"?"PayPal":"bonifico bancario";const reference=input.paymentReference?` · Riferimento: ${input.paymentReference}`:"";
  await recordAvailabilityEvent({requestId:input.requestId,eventType:"payment_reported",fromStatus:current[0]?.status??null,toStatus:"payment_reported",note:`Pagamento comunicato tramite ${methodLabel} · Data: ${input.paidAt}${reference}`,body:input.message||null,amountCents:input.paidAmountCents,attachmentId:input.receiptKey?input.id:null,attachmentName:input.receiptName,createdAt:input.createdAt});
  return updated;
}

export async function getPaymentReceipt(id:string){
  if(usesPostgres())return (await postgresRepository()).getPaymentReceipt(id);
  const {getDb}=await import(".");const rows=await getDb().select({key:paymentSubmissions.receiptKey,name:paymentSubmissions.receiptName,contentType:paymentSubmissions.receiptContentType,size:paymentSubmissions.receiptSize}).from(paymentSubmissions).where(eq(paymentSubmissions.id,id)).limit(1);const row=rows[0];
  return !row?.key?null:{key:row.key,name:row.name||"ricevuta",contentType:row.contentType||"application/octet-stream",size:row.size};
}

export async function recordAvailabilityEvent(event:NewAvailabilityEvent){
  if(usesPostgres())return (await postgresRepository()).recordAvailabilityEvent(event);
  const record={...event,id:event.id??crypto.randomUUID()};const {getDb}=await import(".");await getDb().insert(availabilityEvents).values(record);return record;
}
export async function listAvailabilityEvents(){
  if(usesPostgres())return (await postgresRepository()).listAvailabilityEvents();
  const {getDb}=await import(".");return getDb().select().from(availabilityEvents).orderBy(asc(availabilityEvents.createdAt));
}
