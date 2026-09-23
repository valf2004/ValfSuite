import {headers} from "next/headers";
import {getCheckinSubmission,listAvailabilityRequests} from "../../../../../../db/availability";
import {privateUserFromCookie} from "../../../../../lib/google-auth";
import {buildRoss1000Xml} from "../../../../../lib/ross1000-xml.mjs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="checked_in")return Response.json({message:"Check-in non disponibile."},{status:404});
  try{
    const draft=await getCheckinSubmission(id);if(!draft)throw new Error("Completa il check-in prima di produrre l’XML.");
    const result=buildRoss1000Xml({requestId:id,arrivalDate:item.arrivalDate,draft,structureCode:process.env["ROSS1000_STRUCTURE_CODE"]||"L12648",product:process.env["ROSS1000_PRODUCT"]||"VALF Suite",availableUnits:Number(process.env["ROSS1000_AVAILABLE_UNITS"]||1),availableBeds:Number(process.env["ROSS1000_AVAILABLE_BEDS"]||4)});
    return new Response(result.xml,{headers:{"Content-Type":"application/xml; charset=utf-8","Content-Disposition":`attachment; filename="${result.fileName}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return Response.json({message:error instanceof Error?error.message:"XML non disponibile."},{status:400});}
}
