import {headers} from "next/headers";
import {listAvailabilityEvents,listAvailabilityRequests,recordGuestCommunication} from "../../../../db/availability";
import {sendQuoteEmail} from "../../../lib/availability-email";
import {privateUserFromCookie} from "../../../lib/google-auth";
import {createPaymentToken,hashPaymentToken} from "../../../lib/payment-token";
import {publicBaseUrl} from "../../../lib/public-url";

export async function POST(request:Request){
  try{
    const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
    if(!user)return Response.json({message:"Accesso non autorizzato."},{status:401});
    const data=await request.json().catch(()=>null) as {id?:unknown;subject?:unknown;body?:unknown}|null;
    if(!data||typeof data.id!=="string"||typeof data.subject!=="string"||typeof data.body!=="string")return Response.json({message:"Comunicazione non valida."},{status:400});
    const subject=data.subject.trim().slice(0,180);const body=data.body.trim().slice(0,6000);
    if(!subject||!body)return Response.json({message:"Controlla oggetto e testo."},{status:400});
    const item=(await listAvailabilityRequests()).find(row=>row.id===data.id);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(item.status!=="accepted"||item.quoteAmountCents==null)return Response.json({message:"Il saldo può essere richiesto soltanto per una prenotazione accettata."},{status:409});
    const events=await listAvailabilityEvents();
    const confirmed=events.filter(event=>event.requestId===item.id&&event.eventType==="payment_confirmed").reduce((total,event)=>total+(event.amountCents||0),0);
    const balance=Math.max(0,item.quoteAmountCents-confirmed);
    if(balance<=0)return Response.json({message:"La prenotazione risulta già saldata."},{status:409});
    const token=createPaymentToken();const tokenHash=await hashPaymentToken(token);const paymentUrl=`${publicBaseUrl(request,requestHeaders)}/pagamento/${token}`;
    const dueDate=shiftDate(item.arrivalDate,-7);const deliveredBody=body.replaceAll("{SALDO}",currency(balance,item.language)).replaceAll("{DATA_SALDO}",localizedDate(dueDate,item.language)).replaceAll("{LINK_SALDO}",paymentUrl);
    const actionLabel=({it:"Comunica il saldo",en:"Report balance payment",fr:"Signaler le paiement du solde",es:"Comunicar el pago del saldo",de:"Restzahlung mitteilen"} as Record<string,string>)[item.language]||"Comunica il saldo";
    const sent=await sendQuoteEmail(item.email,subject,deliveredBody,paymentUrl,actionLabel);
    if(!sent.sent)return Response.json({message:"Invio email non configurato."},{status:503});
    const updated=await recordGuestCommunication({requestId:item.id,eventType:"balance_requested",subject,body:deliveredBody,note:"Richiesta di pagamento del saldo inviata al cliente",actorEmail:user.email,paymentTokenHash:tokenHash});
    const event=(await listAvailabilityEvents()).filter(row=>row.requestId===item.id).at(-1);
    return Response.json({request:updated[0],event});
  }catch(error){console.error("balance_request_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Invio della richiesta di saldo non riuscito."},{status:500});}
}

function shiftDate(value:string,days:number){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
function locale(language:string){return ({it:"it-IT",en:"en-GB",fr:"fr-FR",es:"es-ES",de:"de-DE"} as Record<string,string>)[language]||"it-IT";}
function currency(cents:number,language:string){return new Intl.NumberFormat(locale(language),{style:"currency",currency:"EUR"}).format(cents/100);}
function localizedDate(value:string,language:string){return new Intl.DateTimeFormat(locale(language),{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
