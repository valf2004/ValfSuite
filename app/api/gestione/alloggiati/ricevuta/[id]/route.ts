import {headers} from "next/headers";
import {getAlloggiatiReceipt,getAlloggiatiReceiptForRequest,getCheckinSubmission,linkAlloggiatiReceiptToRequest,listAvailabilityRequests,saveAlloggiatiReceipt} from "../../../../../../db/availability";
import {downloadAlloggiatiReceipt} from "../../../../../lib/alloggiati-client";
import {privateUserFromCookie} from "../../../../../lib/google-auth";
import {readReceipt,storeReceiptBytes} from "../../../../../lib/receipt-storage";

const zone="Europe/Rome";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await receiptContext(params);if(context instanceof Response)return context;
  const archived=await getAlloggiatiReceiptForRequest(context.id);
  if(!archived||archived.receiptDate!==context.receiptDate)return Response.json({message:"La ricevuta non è ancora stata archiviata per questa prenotazione."},{status:404});
  const stored=await readReceipt(archived.storageKey);
  if(!stored)return Response.json({message:"Il PDF archiviato non è disponibile nello storage. Ripristina il backup dell’archivio ricevute."},{status:500});
  const download=new URL(request.url).searchParams.get("download")==="1";
  return pdfResponse(stored.body,archived.contentType,archived.size,context.receiptDate,download);
}

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await receiptContext(params);if(context instanceof Response)return context;
  const today=dateInRome(new Date());const age=daysBetween(context.receiptDate,today);
  const linked=await getAlloggiatiReceiptForRequest(context.id);
  if(linked&&linked.receiptDate===context.receiptDate){
    const stored=await readReceipt(linked.storageKey);
    if(stored)return Response.json({archived:true,archivedAt:linked.linkedAt});
    if(age>30)return Response.json({message:"La ricevuta è collegata alla prenotazione, ma il PDF non è disponibile nello storage. Ripristina il backup dell’archivio ricevute."},{status:500});
  }
  let receipt=await getAlloggiatiReceipt(context.receiptDate);const stored=receipt?await readReceipt(receipt.storageKey):null;
  if(receipt&&stored){const linkedAt=new Date().toISOString();await linkAlloggiatiReceiptToRequest({requestId:context.id,receiptDate:receipt.receiptDate,linkedAt});return Response.json({archived:true,archivedAt:linkedAt});}
  if(age<1)return Response.json({message:"La ricevuta sarà disponibile dal giorno successivo all’invio."},{status:409});
  if(age>30)return Response.json({message:"Alloggiati Web rende disponibili le ricevute soltanto per gli ultimi 30 giorni."},{status:410});
  try{
    const pdf=await downloadAlloggiatiReceipt(context.receiptDate);const storageKey=`alloggiati-receipts/${context.receiptDate}.pdf`;const archivedAt=new Date().toISOString();
    const saved=await storeReceiptBytes(storageKey,pdf,"application/pdf");
    receipt=await saveAlloggiatiReceipt({receiptDate:context.receiptDate,storageKey,contentType:saved.contentType,size:saved.size,archivedAt});
    const linkedAt=new Date().toISOString();await linkAlloggiatiReceiptToRequest({requestId:context.id,receiptDate:receipt.receiptDate,linkedAt});
    return Response.json({archived:true,archivedAt:linkedAt});
  }catch(error){const message=error instanceof Error?error.message:"Non è stato possibile archiviare la ricevuta Alloggiati Web.";console.error("alloggiati_receipt_archive_failed",message);return Response.json({message},{status:502});}
}

async function receiptContext(params:Promise<{id:string}>):Promise<{id:string;receiptDate:string}|Response>{
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  const eligible=item?.status==="police_registered"||(item?.status==="archived"&&item.archiveOutcome==="completed");
  if(!item||!eligible)return Response.json({message:"La pratica non risulta ancora registrata in Questura."},{status:404});
  const draft=await getCheckinSubmission(id);if(!draft?.sendAttemptedAt||draft.state!=="sent")return Response.json({message:"Non è disponibile una data di invio Alloggiati Web per questa pratica."},{status:409});
  return{id,receiptDate:dateInRome(draft.sendAttemptedAt)};
}

function dateInRome(value:string|Date){return new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(typeof value==="string"?new Date(value):value);}
function daysBetween(start:string,end:string){return Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86_400_000);}
function pdfResponse(body:BodyInit,contentType:string,size:number,receiptDate:string,download:boolean){const filename=`ricevuta-alloggiati-${receiptDate}.pdf`;return new Response(body,{headers:{"Content-Type":contentType,"Content-Disposition":`${download?"attachment":"inline"}; filename="${filename}"`,"Content-Length":String(size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
