import { and, asc, desc, eq } from "drizzle-orm";
import { availabilityEvents, availabilityQuotes, availabilityRequests, checkinGuests, checkinPractices, paymentSubmissions } from "./schema";
import type { CheckinSubmissionRecord } from "../app/lib/checkin-submission";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "accepted" | "checked_in" | "police_registered" | "archived";
export type PaymentStatus = "unpaid" | "reported" | "partial" | "paid";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type PaymentMethod = "bank_transfer" | "paypal";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;
export type AvailabilityEvent = typeof availabilityEvents.$inferSelect;
type NewAvailabilityEvent = Pick<AvailabilityEvent,"requestId"|"eventType"|"createdAt"> & Partial<Omit<AvailabilityEvent,"id"|"requestId"|"eventType"|"createdAt">> & { id?:string };
export type PublicQuote = { quoteId:string; requestId:string; name:string; email:string; arrivalDate:string; departureDate:string; guestCount:number; language:string; amountCents:number; requestedPaymentCents:number; confirmedAmountCents:number; status:AvailabilityStatus };
export type SentQuote = { id:string; requestId:string; amountCents:number; requestedPaymentCents:number; depositPercent:number; balancePercent:number; subject:string; body:string; tokenHash:string; actorEmail?:string };
export type PaymentConfirmationInput = { requestId:string; amountCents:number; subject:string; body:string; actorEmail:string; fullyPaid:boolean; nextPaymentTokenHash?:string|null; targetStatus?:"accepted"|"checked_in"|"police_registered" };
export type GuestCommunicationInput = { requestId:string; eventType:"balance_requested"|"checkin_invited"; subject:string; body:string; note:string; actorEmail:string; paymentTokenHash?:string|null };
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
  await db.insert(availabilityQuotes).values({id:quote.id,requestId:quote.requestId,amountCents:quote.amountCents,requestedPaymentCents:quote.requestedPaymentCents,depositPercent:quote.depositPercent,balancePercent:quote.balancePercent,subject:quote.subject,body:quote.body,tokenHash:quote.tokenHash,active:true,createdAt});
  const updated=await db.update(availabilityRequests).set({status:"quote_sent",archiveOutcome:null,quoteAmountCents:quote.amountCents,quoteRequestedPaymentCents:quote.requestedPaymentCents,quoteDepositPercent:quote.depositPercent,quoteBalancePercent:quote.balancePercent,quoteSubject:quote.subject,quoteBody:quote.body,quoteSentAt:createdAt,updatedAt:createdAt}).where(eq(availabilityRequests.id,quote.requestId)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId:quote.requestId,eventType:"email_sent",toStatus:"quote_sent",actorEmail:quote.actorEmail??null,note:"Preventivo inviato al cliente",subject:quote.subject,body:quote.body,amountCents:quote.amountCents,createdAt});
  return updated;
}

export async function recordPaymentConfirmation(input:PaymentConfirmationInput){
  if(usesPostgres())return (await postgresRepository()).recordPaymentConfirmation(input);
  const {getDb}=await import(".");const db=getDb();const current=await db.select().from(availabilityRequests).where(eq(availabilityRequests.id,input.requestId));const createdAt=new Date().toISOString();
  if(input.fullyPaid)await db.update(availabilityQuotes).set({active:false}).where(eq(availabilityQuotes.requestId,input.requestId));
  else if(input.nextPaymentTokenHash)await db.update(availabilityQuotes).set({tokenHash:input.nextPaymentTokenHash}).where(and(eq(availabilityQuotes.requestId,input.requestId),eq(availabilityQuotes.active,true)));
  const targetStatus=input.targetStatus||"accepted";
  const updated=await db.update(availabilityRequests).set({status:targetStatus,paymentStatus:input.fullyPaid?"paid":"partial",archiveOutcome:null,updatedAt:createdAt}).where(eq(availabilityRequests.id,input.requestId)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId:input.requestId,eventType:"payment_confirmed",fromStatus:current[0]?.status??null,toStatus:targetStatus,actorEmail:input.actorEmail,note:"Pagamento verificato e conferma inviata al cliente",subject:input.subject,body:input.body,amountCents:input.amountCents,createdAt});
  return updated;
}

export async function recordGuestCommunication(input:GuestCommunicationInput){
  if(usesPostgres())return (await postgresRepository()).recordGuestCommunication(input);
  const {getDb}=await import(".");const db=getDb();const createdAt=new Date().toISOString();
  if(input.paymentTokenHash)await db.update(availabilityQuotes).set({tokenHash:input.paymentTokenHash}).where(and(eq(availabilityQuotes.requestId,input.requestId),eq(availabilityQuotes.active,true)));
  const updated=await db.update(availabilityRequests).set({updatedAt:createdAt}).where(eq(availabilityRequests.id,input.requestId)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId:input.requestId,eventType:input.eventType,toStatus:updated[0].status,actorEmail:input.actorEmail,note:input.note,subject:input.subject,body:input.body,createdAt});
  return updated;
}

export async function recordCheckinSubmission(requestId:string,submission:CheckinSubmissionRecord,actorEmail?:string){
  if(usesPostgres())return (await postgresRepository()).recordCheckinSubmission(requestId,submission,actorEmail);
  const {getDb}=await import(".");const db=getDb();const current=await db.select().from(availabilityRequests).where(eq(availabilityRequests.id,requestId));const existing=await db.select().from(checkinPractices).where(eq(checkinPractices.requestId,requestId));const createdAt=new Date().toISOString();
  const practice={requestId,state:"ready" as const,language:submission.language,guestCount:submission.guestCount,groupType:submission.groupType,arrivalTime:submission.arrivalTime,transport:submission.transport,arrivalNotes:submission.arrivalNotes,privacyAcceptedAt:submission.privacyAcceptedAt,source:actorEmail?"operator" as const:"guest" as const,version:(existing[0]?.version||0)+1,lastError:null,updatedAt:createdAt};
  await db.insert(checkinPractices).values({...practice,createdAt:existing[0]?.createdAt||createdAt}).onConflictDoUpdate({target:checkinPractices.requestId,set:practice});
  await db.delete(checkinGuests).where(eq(checkinGuests.requestId,requestId));
  if(submission.guests.length)await db.insert(checkinGuests).values(submission.guests.map(guest=>({id:`${requestId}:${guest.ordinal}`,requestId,...guest})));
  const updated=await db.update(availabilityRequests).set({status:"checked_in",archiveOutcome:null,updatedAt:createdAt}).where(eq(availabilityRequests.id,requestId)).returning();
  if(updated.length)await recordAvailabilityEvent({requestId,eventType:existing.length?"checkin_updated":"checkin_submitted",fromStatus:current[0]?.status??null,toStatus:"checked_in",actorEmail:actorEmail??null,note:existing.length?(actorEmail?"Check-in aggiornato dall’operatore":"Check-in aggiornato dall’ospite"):(actorEmail?"Check-in compilato dall’operatore":"Check-in online completato dall’ospite"),body:JSON.stringify(submission),createdAt});
  return updated;
}

export async function getCheckinSubmission(requestId:string){
  if(usesPostgres())return (await postgresRepository()).getCheckinSubmission(requestId);
  const {getDb}=await import(".");const db=getDb();const practices=await db.select().from(checkinPractices).where(eq(checkinPractices.requestId,requestId));const practice=practices[0];if(!practice)return null;
  const guests=await db.select().from(checkinGuests).where(eq(checkinGuests.requestId,requestId)).orderBy(asc(checkinGuests.ordinal));
  return checkinDraft(practice,guests);
}

export async function findActiveQuoteByTokenHash(tokenHash:string):Promise<PublicQuote|null>{
  if(usesPostgres())return (await postgresRepository()).findActiveQuoteByTokenHash(tokenHash);
  const {getDb}=await import(".");const db=getDb();const rows=await db.select({quoteId:availabilityQuotes.id,requestId:availabilityQuotes.requestId,amountCents:availabilityQuotes.amountCents,requestedPaymentCents:availabilityQuotes.requestedPaymentCents,name:availabilityRequests.name,email:availabilityRequests.email,arrivalDate:availabilityRequests.arrivalDate,departureDate:availabilityRequests.departureDate,guestCount:availabilityRequests.guestCount,language:availabilityRequests.language,status:availabilityRequests.status}).from(availabilityQuotes).innerJoin(availabilityRequests,eq(availabilityQuotes.requestId,availabilityRequests.id)).where(and(eq(availabilityQuotes.tokenHash,tokenHash),eq(availabilityQuotes.active,true))).limit(1);
  if(!rows[0])return null;const row=rows[0];const confirmed=await db.select({amountCents:availabilityEvents.amountCents}).from(availabilityEvents).where(and(eq(availabilityEvents.requestId,rows[0].requestId),eq(availabilityEvents.eventType,"payment_confirmed")));
  return {...row,requestedPaymentCents:row.requestedPaymentCents??Math.round(row.amountCents*.3),confirmedAmountCents:confirmed.reduce((total,event)=>total+(event.amountCents||0),0)};
}

export async function createPaymentSubmission(input:PaymentSubmissionInput){
  if(usesPostgres())return (await postgresRepository()).createPaymentSubmission(input);
  const {getDb}=await import(".");const db=getDb();const current=await db.select().from(availabilityRequests).where(eq(availabilityRequests.id,input.requestId));
  await db.insert(paymentSubmissions).values(input);
  const updated=await db.update(availabilityRequests).set({paymentStatus:"reported",archiveOutcome:null,updatedAt:input.createdAt}).where(eq(availabilityRequests.id,input.requestId)).returning();
  const methodLabel=input.method==="paypal"?"PayPal":"bonifico bancario";const reference=input.paymentReference?` · Riferimento: ${input.paymentReference}`:"";
  await recordAvailabilityEvent({requestId:input.requestId,eventType:"payment_reported",fromStatus:current[0]?.status??null,toStatus:current[0]?.status??null,note:`Pagamento comunicato tramite ${methodLabel} · Data: ${input.paidAt}${reference}`,body:input.message||null,amountCents:input.paidAmountCents,attachmentId:input.receiptKey?input.id:null,attachmentName:input.receiptName,createdAt:input.createdAt});
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

function checkinDraft(practice:typeof checkinPractices.$inferSelect,guests:Array<typeof checkinGuests.$inferSelect>){
  const values:Record<string,string>={"arrival-time":practice.arrivalTime,transport:practice.transport,"arrival-notes":practice.arrivalNotes};
  for(const guest of guests){const prefix=guest.ordinal===0?"lead":`guest-${guest.ordinal}`;values[`${prefix}-name`]=guest.firstName;values[`${prefix}-surname`]=guest.lastName;values[`${prefix}-birth`]=guest.birthDate;values[`${prefix}-sex`]=guest.sexCode;values[`${prefix}-citizenship`]=guest.citizenshipCode;values[`${prefix}-birthCountry`]=guest.birthCountryCode;if(guest.birthPlaceCode)values[`${prefix}-birthPlace`]=guest.birthPlaceCode;if(guest.documentTypeCode)values[`${prefix}-documentType`]=guest.documentTypeCode;if(guest.documentNumber)values[`${prefix}-documentNumber`]=guest.documentNumber;if(guest.issuePlaceCode)values[`${prefix}-issuePlace`]=guest.issuePlaceCode;}
  return {state:practice.state,language:practice.language,guestCount:practice.guestCount,groupType:practice.groupType,version:practice.version,values};
}
