import { headers } from "next/headers";
import { getCheckinSubmission, listAvailabilityRequests, recordCheckinSubmission } from "../../../../../db/availability";
import { prepareCheckinSubmission,validateCheckinLookupCodes } from "../../../../lib/checkin-submission";
import { privateUserFromCookie } from "../../../../lib/google-auth";
import {listAlloggiatiLookupValues} from "../../../../../db/alloggiati-lookups";
import {CheckinUploadError,parseCheckinRequest,replaceUploadedCheckinDocuments} from "../../../../lib/checkin-document-upload";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const requestHeaders=await headers();
    const user=await privateUserFromCookie(requestHeaders.get("cookie"));
    if(!user)return Response.json({message:"Accesso non autorizzato."},{status:401});
    const {id}=await params;
    const item=(await listAvailabilityRequests()).find(row=>row.id===id);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(!["accepted","checked_in"].includes(item.status))return Response.json({message:item.status==="police_registered"?"Check-in già inviato ad Alloggiati Web.":"Il check-in non è disponibile per questa prenotazione."},{status:409});
    const existing=await getCheckinSubmission(item.id);if(existing?.sendAttemptedAt)return Response.json({message:"Il check-in non è modificabile: esiste un invio Alloggiati Web già effettuato o da verificare."},{status:409});
    const {data,files}=await parseCheckinRequest(request);
    const result=prepareCheckinSubmission(data,item);
    if(!result.saved)return Response.json({message:result.error},{status:400});
    const lookupError=validateCheckinLookupCodes(result.saved,await listAlloggiatiLookupValues());
    if(lookupError)return Response.json({message:lookupError},{status:400});
    const updated=await recordCheckinSubmission(item.id,result.saved,user.email);
    await replaceUploadedCheckinDocuments(item.id,files,"operator");
    return Response.json({ok:true,status:updated[0]?.status||"checked_in"});
  }catch(error){console.error("operator_checkin_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:error instanceof CheckinUploadError?error.message:"Registrazione del check-in non riuscita."},{status:error instanceof CheckinUploadError?400:500});}
}
