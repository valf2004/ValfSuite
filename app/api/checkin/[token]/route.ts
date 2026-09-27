import {getCheckinSubmission,listAvailabilityRequests,recordCheckinSubmission} from "../../../../db/availability";
import {prepareCheckinSubmission,validateCheckinLookupCodes} from "../../../lib/checkin-submission";
import {verifyCheckinToken} from "../../../lib/checkin-token";
import {listAlloggiatiLookupValues} from "../../../../db/alloggiati-lookups";
import {CheckinUploadError,parseCheckinRequest,replaceUploadedCheckinDocuments} from "../../../lib/checkin-document-upload";

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;const requestId=await verifyCheckinToken(token);
    if(!requestId)return Response.json({message:"Collegamento non valido o scaduto."},{status:404});
    const item=(await listAvailabilityRequests()).find(row=>row.id===requestId);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(!["accepted","checked_in"].includes(item.status))return Response.json({message:item.status==="police_registered"?"Check-in già inviato alla struttura.":"Il check-in non è disponibile per questa prenotazione."},{status:409});
    const existing=await getCheckinSubmission(item.id);if(existing?.sendAttemptedAt)return Response.json({message:"Il check-in non è modificabile: esiste un invio Alloggiati Web già effettuato o da verificare."},{status:409});
    const {data,files}=await parseCheckinRequest(request);
    const result=prepareCheckinSubmission(data,item);
    if(!result.saved)return Response.json({message:result.error},{status:400});
    const lookupError=validateCheckinLookupCodes(result.saved,await listAlloggiatiLookupValues());
    if(lookupError)return Response.json({message:lookupError},{status:400});
    const updated=await recordCheckinSubmission(item.id,result.saved);
    await replaceUploadedCheckinDocuments(item.id,files,"guest");
    return Response.json({ok:true,status:updated[0]?.status||"checked_in"});
  }catch(error){console.error("checkin_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:error instanceof CheckinUploadError?error.message:"Invio del check-in non riuscito."},{status:error instanceof CheckinUploadError?400:500});}
}
