import {listAvailabilityRequests,recordCheckinSubmission} from "../../../../db/availability";
import {verifyCheckinToken} from "../../../lib/checkin-token";

const languages=new Set(["it","en","fr","es","de"]);
const personFields=["name","surname","birth","sex","citizenship","birthCountry","birthPlace"];
const leadFields=[...personFields,"documentType","documentNumber","issuePlace"];

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;const requestId=await verifyCheckinToken(token);
    if(!requestId)return Response.json({message:"Collegamento non valido o scaduto."},{status:404});
    const item=(await listAvailabilityRequests()).find(row=>row.id===requestId);
    if(!item)return Response.json({message:"Prenotazione non trovata."},{status:404});
    if(item.status!=="accepted")return Response.json({message:item.status==="checked_in"?"Check-in già completato.":"Il check-in non è disponibile per questa prenotazione."},{status:409});
    const data=await request.json().catch(()=>null) as {guestCount?:unknown;language?:unknown;values?:unknown;privacyAccepted?:unknown}|null;
    if(!data||data.guestCount!==item.guestCount||typeof data.language!=="string"||!languages.has(data.language)||data.privacyAccepted!==true||!data.values||typeof data.values!=="object")return Response.json({message:"Controlla i dati del check-in."},{status:400});
    const values=sanitizeValues(data.values as Record<string,unknown>);
    if(values["arrival-date"]!==item.arrivalDate||values["departure-date"]!==item.departureDate||!required(values,"lead",leadFields)||!values["arrival-time"]||!values.transport)return Response.json({message:"Completa tutti i dati richiesti."},{status:400});
    for(let index=1;index<item.guestCount;index++)if(!required(values,`guest-${index}`,personFields))return Response.json({message:"Completa i dati di tutti gli ospiti."},{status:400});
    const submittedAt=new Date().toISOString();
    const saved=JSON.stringify({language:data.language,guestCount:item.guestCount,values,privacyAcceptedAt:submittedAt});
    const updated=await recordCheckinSubmission(item.id,saved);
    return Response.json({ok:true,status:updated[0]?.status||"checked_in"});
  }catch(error){console.error("checkin_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Invio del check-in non riuscito."},{status:500});}
}

function required(values:Record<string,string>,prefix:string,fields:string[]){return fields.every(field=>Boolean(values[`${prefix}-${field}`]));}
function sanitizeValues(input:Record<string,unknown>){
  const result:Record<string,string>={};
  for(const [key,value] of Object.entries(input)){
    if(typeof value!=="string"||value.length>1000||!allowedKey(key))continue;
    result[key]=value.trim();
  }
  return result;
}
function allowedKey(key:string){return ["arrival-date","departure-date","reference","arrival-time","transport","arrival-notes"].includes(key)||/^lead-(name|surname|birth|sex|citizenship|birthCountry|birthPlace|documentType|documentNumber|issuePlace)$/.test(key)||/^guest-[1-3]-(name|surname|birth|sex|citizenship|birthCountry|birthPlace)$/.test(key);}
