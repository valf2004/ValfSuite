import {headers} from "next/headers";
import {listAvailabilityRequests,resolveAlloggiatiSendAttempt,type AlloggiatiSendResolution} from "../../../../../../../db/availability";
import {removeAllCheckinDocuments} from "../../../../../../lib/checkin-document-upload";
import {privateUserFromCookie} from "../../../../../../lib/google-auth";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return Response.json({error:"unauthorized"},{status:401});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="checked_in")return Response.json({error:"La pratica non è disponibile per la riconciliazione."},{status:404});
  const body=await request.json().catch(()=>({})) as {resolution?:unknown;confirmation?:unknown};
  const resolution=body.resolution as AlloggiatiSendResolution;
  if(!["received","not_received"].includes(resolution))return Response.json({error:"Esito di riconciliazione non valido."},{status:400});
  const expected=resolution==="received"?"SCHEDINE ACQUISITE":"NESSUNA SCHEDINA";
  if(body.confirmation!==expected)return Response.json({error:"Conferma esplicita mancante."},{status:400});
  if(!await resolveAlloggiatiSendAttempt(id,resolution,user.email))return Response.json({error:"Non esiste un tentativo da riconciliare."},{status:409});
  let documentsDeleted=true;if(resolution==="received"){try{await removeAllCheckinDocuments(id);}catch(error){documentsDeleted=false;console.error("checkin_documents_cleanup_failed",error instanceof Error?error.message:"unknown");}}
  return Response.json({ok:true,resolution,documentsDeleted});
}
