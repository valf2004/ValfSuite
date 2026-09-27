import {headers} from "next/headers";
import {beginAlloggiatiSend,getCheckinSubmission,listAvailabilityRequests,recordAlloggiatiSendResult} from "../../../../../../db/availability";
import {listAlloggiatiLookupValues} from "../../../../../../db/alloggiati-lookups";
import {buildAlloggiatiRecords,type AlloggiatiDraft} from "../../../../../lib/alloggiati-record";
import {sendAlloggiatiRecords} from "../../../../../lib/alloggiati-client";
import {removeAllCheckinDocuments} from "../../../../../lib/checkin-document-upload";
import {privateUserFromCookie} from "../../../../../lib/google-auth";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return Response.json({error:"unauthorized"},{status:401});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="checked_in")return Response.json({error:"Il check-in non è disponibile per l’invio."},{status:404});
  const body=await request.json().catch(()=>({})) as {apartmentId?:unknown;confirmation?:unknown};
  if(body.confirmation!=="INVIO DEFINITIVO")return Response.json({error:"Conferma esplicita mancante."},{status:400});
  const apartmentId=typeof body.apartmentId==="string"?body.apartmentId.trim():"";
  const [draft,lookups]=await Promise.all([getCheckinSubmission(id),listAlloggiatiLookupValues()]);
  if(!draft)return Response.json({error:"Completa il check-in prima dell’invio."},{status:409});
  if(draft.sendAttemptedAt)return Response.json({error:"Esiste già un tentativo di invio da riconciliare sul portale Alloggiati Web.",requiresReconciliation:true,attemptedAt:draft.sendAttemptedAt},{status:409});
  if(draft.state!=="validated")return Response.json({error:"Esegui e supera il test sull’ultima versione del check-in prima dell’invio."},{status:409});
  if((process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments"){
    const allowed=new Set(lookups.filter(row=>row.tableName==="ListaAppartamenti").map(row=>row.itemKey));
    if(allowed.size&&!allowed.has(apartmentId))return Response.json({error:"Seleziona un appartamento presente nella tabella Alloggiati aggiornata."},{status:400});
  }
  let preview;try{preview=buildAlloggiatiRecords(item.arrivalDate,item.departureDate,draft as AlloggiatiDraft,lookups);}catch(error){return Response.json({error:error instanceof Error?error.message:"Non è possibile generare le schedine."},{status:400});}
  const attemptedAt=new Date().toISOString();
  if(!await beginAlloggiatiSend(id,draft.version,apartmentId,attemptedAt))return Response.json({error:"L’invio non può essere avviato: ripeti il test senza cambiare appartamento oppure verifica che la pratica non sia già in lavorazione."},{status:409});
  try{
    const result=await sendAlloggiatiRecords(preview.records,apartmentId);
    const details=result.details.map((detail,index)=>({row:index+1,success:detail.success,message:[detail.errorCode,detail.errorDescription,detail.errorDetail].filter(Boolean).join(" · ")}));
    const success=result.success&&result.validCount===result.totalCount&&details.every(detail=>detail.success);
    const message=success?"Tutte le schedine sono state acquisite da Alloggiati Web.":result.generalError||details.find(detail=>!detail.success)?.message||"L’invio non è stato acquisito integralmente.";
    const recorded=await recordAlloggiatiSendResult({requestId:id,success,validCount:result.validCount,totalCount:result.totalCount,message,details,actorEmail:user.email,checkinVersion:draft.version,apartmentId:apartmentId||undefined,attemptedAt});
    if(!recorded)return Response.json({error:"Alloggiati Web ha risposto, ma non è stato possibile registrare l’esito. Verifica le schedine sul portale prima di qualsiasi altra operazione.",attemptedAt,requiresReconciliation:true},{status:500});
    let documentsDeleted=true;if(success){try{await removeAllCheckinDocuments(id);}catch(error){documentsDeleted=false;console.error("checkin_documents_cleanup_failed",error instanceof Error?error.message:"unknown");}}
    return Response.json({success,validCount:result.validCount,totalCount:result.totalCount,message,details,attemptedAt,documentsDeleted,requiresReconciliation:!success},{status:success?200:422});
  }catch(error){
    const message=error instanceof Error?error.message:"Invio Alloggiati Web non riuscito.";
    await recordAlloggiatiSendResult({requestId:id,success:false,validCount:0,totalCount:preview.records.length,message,details:[{ambiguous:true,message}],actorEmail:user.email,checkinVersion:draft.version,apartmentId:apartmentId||undefined,attemptedAt}).catch(recordError=>console.error("alloggiati_send_audit_failed",recordError));
    console.error("alloggiati_send_failed",message);
    return Response.json({error:message,attemptedAt,requiresReconciliation:true},{status:502});
  }
}
