import {headers} from "next/headers";
import {getAlloggiatiReceipt,getCheckinSubmission,listAvailabilityRequests,saveAlloggiatiReceipt} from "../../../../../../db/availability";
import {downloadAlloggiatiReceipt} from "../../../../../lib/alloggiati-client";
import {privateUserFromCookie} from "../../../../../lib/google-auth";
import {readReceipt,storeReceiptBytes} from "../../../../../lib/receipt-storage";

const zone="Europe/Rome";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  const receiptEligible=item?.status==="police_registered"||(item?.status==="archived"&&item.archiveOutcome==="completed");
  if(!item||!receiptEligible)return Response.json({message:"La pratica non risulta ancora registrata in Questura."},{status:404});
  const draft=await getCheckinSubmission(id);if(!draft?.sendAttemptedAt||draft.state!=="sent")return Response.json({message:"Non è disponibile una data di invio Alloggiati Web per questa pratica."},{status:409});
  const receiptDate=dateInRome(draft.sendAttemptedAt),today=dateInRome(new Date());const age=daysBetween(receiptDate,today);
  const archived=await getAlloggiatiReceipt(receiptDate);
  if(archived){
    const stored=await readReceipt(archived.storageKey);
    if(stored)return pdfResponse(stored.body,archived.contentType,archived.size,receiptDate);
    if(age>30)return Response.json({message:"La ricevuta risulta archiviata, ma il file non è disponibile nello storage. Ripristina il backup dell’archivio ricevute."},{status:500});
  }
  if(age<1)return Response.json({message:"La ricevuta sarà disponibile dal giorno successivo all’invio."},{status:409});
  if(age>30)return Response.json({message:"Alloggiati Web rende disponibili le ricevute soltanto per gli ultimi 30 giorni."},{status:410});
  try{
    const pdf=await downloadAlloggiatiReceipt(receiptDate);const storageKey=`alloggiati-receipts/${receiptDate}.pdf`;const archivedAt=new Date().toISOString();
    const stored=await storeReceiptBytes(storageKey,pdf,"application/pdf");
    await saveAlloggiatiReceipt({receiptDate,storageKey,contentType:stored.contentType,size:stored.size,archivedAt});
    return pdfResponse(pdf,stored.contentType,stored.size,receiptDate);
  }catch(error){const message=error instanceof Error?error.message:"Non è stato possibile scaricare la ricevuta Alloggiati Web.";console.error("alloggiati_receipt_failed",message);return Response.json({message},{status:502});}
}

function dateInRome(value:string|Date){return new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(typeof value==="string"?new Date(value):value);}
function daysBetween(start:string,end:string){return Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86_400_000);}
function pdfResponse(body:BodyInit,contentType:string,size:number,receiptDate:string){const filename=`ricevuta-alloggiati-${receiptDate}.pdf`;return new Response(body,{headers:{"Content-Type":contentType,"Content-Disposition":`attachment; filename="${filename}"`,"Content-Length":String(size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
