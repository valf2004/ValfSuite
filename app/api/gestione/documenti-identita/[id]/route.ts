import {headers} from "next/headers";
import {getCheckinDocument} from "../../../../../db/availability";
import {privateUserFromCookie} from "../../../../lib/google-auth";
import {removeCheckinDocument} from "../../../../lib/checkin-document-upload";
import {readReceipt} from "../../../../lib/receipt-storage";

async function authorized(){const requestHeaders=await headers();return privateUserFromCookie(requestHeaders.get("cookie"));}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {id}=await params;const metadata=await getCheckinDocument(id);
  if(!metadata)return Response.json({message:"Documento non trovato."},{status:404});
  const stored=await readReceipt(metadata.storageKey);
  if(!stored)return Response.json({message:"File non trovato."},{status:404});
  return new Response(stored.body,{headers:{"Content-Type":metadata.contentType||stored.contentType,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(metadata.originalName)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return Response.json({message:"Accesso non autorizzato."},{status:401});
  const {id}=await params;return await removeCheckinDocument(id)?Response.json({ok:true}):Response.json({message:"Documento non trovato."},{status:404});
}
