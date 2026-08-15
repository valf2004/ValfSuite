import {headers} from "next/headers";
import {listAvailabilityEvents,listAvailabilityRequests,recordGuestCommunication} from "../../../../db/availability";
import {sendQuoteEmail} from "../../../lib/availability-email";
import {createCheckinToken} from "../../../lib/checkin-token";
import {privateUserFromCookie} from "../../../lib/google-auth";
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
    if(item.status!=="accepted")return Response.json({message:"Il check-in può essere richiesto soltanto per una prenotazione accettata."},{status:409});
    const checkinUrl=`${publicBaseUrl(request,requestHeaders)}/checkin/${await createCheckinToken(item.id,item.departureDate)}`;
    const deliveredBody=body.replaceAll("{LINK_CHECKIN}",checkinUrl);
    const actionLabel=({it:"Compila il check-in online",en:"Complete online check-in",fr:"Effectuer le check-in en ligne",es:"Completar el check-in online",de:"Online-Check-in ausfüllen"} as Record<string,string>)[item.language]||"Compila il check-in online";
    const sent=await sendQuoteEmail(item.email,subject,deliveredBody,checkinUrl,actionLabel);
    if(!sent.sent)return Response.json({message:"Invio email non configurato."},{status:503});
    const updated=await recordGuestCommunication({requestId:item.id,eventType:"checkin_invited",subject,body:deliveredBody,note:"Invito al check-in online inviato al cliente",actorEmail:user.email});
    const event=(await listAvailabilityEvents()).filter(row=>row.requestId===item.id).at(-1);
    return Response.json({request:updated[0],event});
  }catch(error){console.error("checkin_invitation_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Invio dell’invito al check-in non riuscito."},{status:500});}
}
