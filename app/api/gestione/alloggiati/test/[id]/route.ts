import {headers} from "next/headers";
import {getCheckinSubmission,listAvailabilityRequests,recordAlloggiatiTestResult} from "../../../../../../db/availability";
import {listAlloggiatiLookupValues} from "../../../../../../db/alloggiati-lookups";
import {buildAlloggiatiRecords,type AlloggiatiDraft} from "../../../../../lib/alloggiati-record";
import {testAlloggiatiRecords} from "../../../../../lib/alloggiati-client";
import {privateUserFromCookie} from "../../../../../lib/google-auth";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return Response.json({error:"unauthorized"},{status:401});
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="checked_in")return Response.json({error:"Il check-in non è disponibile per il test."},{status:404});
  const body=await request.json().catch(()=>({})) as {apartmentId?:unknown};
  const apartmentId=typeof body.apartmentId==="string"?body.apartmentId.trim():"";
  try{
    const [draft,lookups]=await Promise.all([getCheckinSubmission(id),listAlloggiatiLookupValues()]);
    if(!draft)throw new Error("Completa il check-in prima di eseguire il test.");
    if(draft.version<1)throw new Error("La versione del check-in non è valida.");
    if((process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments"){
      const allowed=new Set(lookups.filter(row=>row.tableName==="ListaAppartamenti").map(row=>row.itemKey));
      if(allowed.size&&!allowed.has(apartmentId))throw new Error("Seleziona un appartamento presente nella tabella Alloggiati aggiornata.");
    }
    const preview=buildAlloggiatiRecords(item.arrivalDate,item.departureDate,draft as AlloggiatiDraft,lookups);
    const result=await testAlloggiatiRecords(preview.records,apartmentId);
    const rowErrors=result.details.map((detail,index)=>({row:index+1,success:detail.success,message:[detail.errorCode,detail.errorDescription,detail.errorDetail].filter(Boolean).join(" · ")}));
    const message=result.success?"Tutte le schedine hanno superato il controllo preliminare.":result.generalError||rowErrors.find(row=>!row.success)?.message||"Una o più schedine non hanno superato il controllo.";
    await recordAlloggiatiTestResult({requestId:id,success:result.success,validCount:result.validCount,totalCount:result.totalCount,message,details:rowErrors,actorEmail:user.email,checkinVersion:draft.version,apartmentId:apartmentId||undefined});
    return Response.json({success:result.success,validCount:result.validCount,totalCount:result.totalCount,message,details:rowErrors,testedAt:new Date().toISOString()},{status:result.success?200:422});
  }catch(error){
    const message=error instanceof Error?error.message:"Test Alloggiati non riuscito.";
    console.error("alloggiati_test_failed",message);
    return Response.json({error:message},{status:400});
  }
}
