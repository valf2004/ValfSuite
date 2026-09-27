import {headers} from "next/headers";
import {getCheckinSubmission,listAvailabilityRequests} from "../../../../../../db/availability";
import {downloadAlloggiatiReceipt} from "../../../../../lib/alloggiati-client";
import {privateUserFromCookie} from "../../../../../lib/google-auth";

const zone="Europe/Rome";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="police_registered")return Response.json({message:"La pratica non risulta ancora registrata in Questura."},{status:404});
  const draft=await getCheckinSubmission(id);if(!draft?.sendAttemptedAt||draft.state!=="sent")return Response.json({message:"Non è disponibile una data di invio Alloggiati Web per questa pratica."},{status:409});
  const receiptDate=dateInRome(draft.sendAttemptedAt),today=dateInRome(new Date());const age=daysBetween(receiptDate,today);
  if(age<1)return Response.json({message:"La ricevuta sarà disponibile dal giorno successivo all’invio."},{status:409});
  if(age>30)return Response.json({message:"Alloggiati Web rende disponibili le ricevute soltanto per gli ultimi 30 giorni."},{status:410});
  try{
    const pdf=await downloadAlloggiatiReceipt(receiptDate);const filename=`ricevuta-alloggiati-${receiptDate}.pdf`;
    return new Response(pdf,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}"`,"Content-Length":String(pdf.byteLength),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){const message=error instanceof Error?error.message:"Non è stato possibile scaricare la ricevuta Alloggiati Web.";console.error("alloggiati_receipt_failed",message);return Response.json({message},{status:502});}
}

function dateInRome(value:string|Date){return new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(typeof value==="string"?new Date(value):value);}
function daysBetween(start:string,end:string){return Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86_400_000);}
