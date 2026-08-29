import { headers } from "next/headers";
import { listAvailabilityRequests, recordCheckinSubmission } from "../../../../../db/availability";
import { prepareCheckinSubmission } from "../../../../lib/checkin-submission";
import { privateUserFromCookie } from "../../../../lib/google-auth";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const requestHeaders=await headers();
    const user=await privateUserFromCookie(requestHeaders.get("cookie"));
    if(!user)return Response.json({message:"Accesso non autorizzato."},{status:401});
    const {id}=await params;
    const item=(await listAvailabilityRequests()).find(row=>row.id===id);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(item.status!=="accepted")return Response.json({message:item.status==="checked_in"?"Check-in già completato.":"Il check-in non è disponibile per questa prenotazione."},{status:409});
    const data=await request.json().catch(()=>null) as {guestCount?:unknown;language?:unknown;values?:unknown;privacyAccepted?:unknown}|null;
    const result=prepareCheckinSubmission(data,item);
    if(!result.saved)return Response.json({message:result.error},{status:400});
    const updated=await recordCheckinSubmission(item.id,result.saved,user.email);
    return Response.json({ok:true,status:updated[0]?.status||"checked_in"});
  }catch(error){console.error("operator_checkin_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Registrazione del check-in non riuscita."},{status:500});}
}
