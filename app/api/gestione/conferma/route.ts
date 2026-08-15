import {headers} from "next/headers";
import {listAvailabilityEvents,listAvailabilityRequests,recordPaymentConfirmation} from "../../../../db/availability";
import {privateUserFromCookie} from "../../../lib/google-auth";
import {sendPaymentConfirmationEmail} from "../../../lib/availability-email";
import {createCheckinToken} from "../../../lib/checkin-token";
import {createPaymentToken,hashPaymentToken} from "../../../lib/payment-token";
import {todayAtProperty} from "../../../lib/property-date";
import {publicBaseUrl} from "../../../lib/public-url";

export async function POST(request:Request){
  try{
    const requestHeaders=await headers();
    const user=await privateUserFromCookie(requestHeaders.get("cookie"));
    if(!user)return Response.json({message:"Accesso non autorizzato."},{status:401});
    const data=await request.json().catch(()=>null) as {id?:unknown;amount?:unknown;subject?:unknown;body?:unknown}|null;
    const amountText=typeof data?.amount==="string"?data.amount.trim().replace(",","."):"";
    if(!data||typeof data.id!=="string"||typeof data.subject!=="string"||typeof data.body!=="string"||!/^(?:\d+)(?:\.\d{1,2})?$/.test(amountText))return Response.json({message:"Controlla i dati della conferma."},{status:400});
    const subject=data.subject.trim().slice(0,180);const body=data.body.trim().slice(0,6000);const amountCents=Math.round(Number(amountText)*100);
    if(!subject||!body||amountCents<=0)return Response.json({message:"Controlla i dati della conferma."},{status:400});
    const item=(await listAvailabilityRequests()).find(row=>row.id===data.id);
    if(!item)return Response.json({message:"Richiesta non trovata."},{status:404});
    if(item.status!=="payment_reported")return Response.json({message:"Il pagamento non è in attesa di verifica."},{status:409});
    if(item.quoteAmountCents==null)return Response.json({message:"Il valore del preventivo non è disponibile."},{status:409});
    const allEvents=await listAvailabilityEvents();
    const previousStatus=[...allEvents].reverse().find(event=>event.requestId===item.id&&event.eventType==="payment_reported")?.fromStatus;
    const targetStatus=previousStatus==="checked_in"||previousStatus==="police_registered"?previousStatus:"accepted";
    const confirmedCents=allEvents.filter(event=>event.requestId===item.id&&event.eventType==="payment_confirmed").reduce((total,event)=>total+(event.amountCents||0),0);
    const remainingBefore=Math.max(0,item.quoteAmountCents-confirmedCents);
    if(amountCents>remainingBefore)return Response.json({message:`L’importo supera il saldo residuo di ${currency(remainingBefore,item.language)}.`},{status:400});
    const remainingAfter=Math.max(0,remainingBefore-amountCents);
    const dueDate=shiftDate(item.arrivalDate,-7);
    const baseUrl=publicBaseUrl(request,requestHeaders);
    const nextPaymentToken=remainingAfter>0?createPaymentToken():null;
    const nextPaymentTokenHash=nextPaymentToken?await hashPaymentToken(nextPaymentToken):null;
    const actionUrl=nextPaymentToken?`${baseUrl}/pagamento/${nextPaymentToken}`:`${baseUrl}/checkin/${await createCheckinToken(item.id,item.departureDate)}`;
    const actionLabel=nextActionLabel(remainingAfter,item.language);
    const replacements:Record<string,string>={"{IMPORTO_RICEVUTO}":currency(amountCents,item.language),"{SALDO}":currency(remainingAfter,item.language),"{DATA_SALDO}":localizedDate(dueDate,item.language),"{ISTRUZIONI_SALDO}":balanceInstruction(remainingAfter,dueDate,item.language),"{ISTRUZIONI_PROSSIMO_PASSO}":nextStepInstruction(remainingAfter,actionUrl,item.language),"{LINK_AZIONE}":actionUrl};
    const deliveredBody=Object.entries(replacements).reduce((text,[placeholder,value])=>text.replaceAll(placeholder,value),body);
    const result=await sendPaymentConfirmationEmail(item.email,subject,deliveredBody,actionUrl,actionLabel);
    if(!result.sent)return Response.json({message:"Invio email non configurato."},{status:503});
    const updated=await recordPaymentConfirmation({requestId:item.id,amountCents,subject,body:deliveredBody,actorEmail:user.email,fullyPaid:remainingAfter===0,nextPaymentTokenHash,targetStatus});
    const event=(await listAvailabilityEvents()).filter(row=>row.requestId===item.id).at(-1);
    return Response.json({request:updated[0],event,sentBy:user.email});
  }catch(error){console.error("payment_confirmation_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Invio della conferma non riuscito."},{status:500});}
}

function nextActionLabel(remaining:number,language:string){
  const copies:Record<string,[string,string]>={it:["Comunica il saldo","Compila il check-in online"],en:["Report balance payment","Complete online check-in"],fr:["Signaler le paiement du solde","Effectuer le check-in en ligne"],es:["Comunicar el pago del saldo","Completar el check-in online"],de:["Restzahlung mitteilen","Online-Check-in ausfüllen"]};
  const copy=copies[language]||copies.it;return remaining>0?copy[0]:copy[1];
}
function nextStepInstruction(remaining:number,url:string,language:string){
  const copies:Record<string,[string,string]>={
    it:[`Dopo aver effettuato il saldo, comunicalo tramite questo modulo:\n${url}`,`Puoi ora completare il check-in online tramite questo collegamento:\n${url}`],
    en:[`After paying the balance, report it using this form:\n${url}`,`You can now complete your online check-in here:\n${url}`],
    fr:[`Après avoir réglé le solde, signalez-le à l’aide de ce formulaire :\n${url}`,`Vous pouvez maintenant effectuer votre check-in en ligne ici :\n${url}`],
    es:[`Después de pagar el saldo, comunícalo mediante este formulario:\n${url}`,`Ya puedes completar el check-in online aquí:\n${url}`],
    de:[`Teilen Sie uns die Restzahlung anschließend über dieses Formular mit:\n${url}`,`Sie können jetzt den Online-Check-in über diesen Link ausfüllen:\n${url}`],
  };const copy=copies[language]||copies.it;return remaining>0?copy[0]:copy[1];
}

function shiftDate(value:string,days:number){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
function locale(language:string){return ({it:"it-IT",en:"en-GB",fr:"fr-FR",es:"es-ES",de:"de-DE"} as Record<string,string>)[language]||"it-IT";}
function currency(cents:number,language:string){return new Intl.NumberFormat(locale(language),{style:"currency",currency:"EUR"}).format(cents/100);}
function localizedDate(value:string,language:string){return new Intl.DateTimeFormat(locale(language),{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function balanceInstruction(remaining:number,dueDate:string,language:string){
  const amount=currency(remaining,language);const date=localizedDate(dueDate,language);const urgent=todayAtProperty()>=dueDate;
  const copies:Record<string,{paid:string;scheduled:string;urgent:string}>={
    it:{paid:"Il soggiorno risulta interamente saldato.",scheduled:`Resta da versare un saldo di ${amount}. Ti ricordiamo di effettuare il pagamento entro il ${date}, 7 giorni prima dell’arrivo.`,urgent:`Resta da versare un saldo di ${amount}. Poiché mancano meno di 7 giorni all’arrivo, ti chiediamo di effettuare il saldo quanto prima.`},
    en:{paid:"The stay is now fully paid.",scheduled:`A balance of ${amount} remains due. Please pay it by ${date}, 7 days before arrival.`,urgent:`A balance of ${amount} remains due. As arrival is less than 7 days away, please pay the balance as soon as possible.`},
    fr:{paid:"Le séjour est désormais entièrement réglé.",scheduled:`Il reste un solde de ${amount} à régler. Merci d’effectuer le paiement avant le ${date}, soit 7 jours avant l’arrivée.`,urgent:`Il reste un solde de ${amount} à régler. L’arrivée étant prévue dans moins de 7 jours, merci de régler le solde dès que possible.`},
    es:{paid:"La estancia está totalmente pagada.",scheduled:`Queda pendiente un saldo de ${amount}. Recuerda abonarlo antes del ${date}, 7 días antes de la llegada.`,urgent:`Queda pendiente un saldo de ${amount}. Como faltan menos de 7 días para la llegada, te pedimos que lo abones lo antes posible.`},
    de:{paid:"Der Aufenthalt ist nun vollständig bezahlt.",scheduled:`Es ist noch ein Restbetrag von ${amount} offen. Bitte zahlen Sie ihn bis zum ${date}, 7 Tage vor der Anreise.`,urgent:`Es ist noch ein Restbetrag von ${amount} offen. Da die Anreise in weniger als 7 Tagen erfolgt, bitten wir um schnellstmögliche Zahlung.`},
  };
  const copy=copies[language]||copies.it;return remaining<=0?copy.paid:urgent?copy.urgent:copy.scheduled;
}
