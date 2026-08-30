import {listAvailabilityRequests,recordCheckinSubmission} from "../../../../db/availability";
import {prepareCheckinSubmission,validateCheckinLookupCodes} from "../../../lib/checkin-submission";
import {verifyCheckinToken} from "../../../lib/checkin-token";
import {listAlloggiatiLookupValues} from "../../../../db/alloggiati-lookups";

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;const requestId=await verifyCheckinToken(token);
    if(!requestId)return Response.json({message:"Collegamento non valido o scaduto."},{status:404});
    const item=(await listAvailabilityRequests()).find(row=>row.id===requestId);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(!["accepted","checked_in"].includes(item.status))return Response.json({message:item.status==="police_registered"?"Check-in già inviato alla struttura.":"Il check-in non è disponibile per questa prenotazione."},{status:409});
    const data=await request.json().catch(()=>null) as {guestCount?:unknown;language?:unknown;groupType?:unknown;values?:unknown;privacyAccepted?:unknown}|null;
    const result=prepareCheckinSubmission(data,item);
    if(!result.saved)return Response.json({message:result.error},{status:400});
    const lookupError=validateCheckinLookupCodes(result.saved,await listAlloggiatiLookupValues());
    if(lookupError)return Response.json({message:lookupError},{status:400});
    const updated=await recordCheckinSubmission(item.id,result.saved);
    return Response.json({ok:true,status:updated[0]?.status||"checked_in"});
  }catch(error){console.error("checkin_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Invio del check-in non riuscito."},{status:500});}
}
