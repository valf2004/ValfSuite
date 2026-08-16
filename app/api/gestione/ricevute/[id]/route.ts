import {headers} from "next/headers";
import {getPaymentReceipt} from "../../../../../db/availability";
import {privateUserFromCookie} from "../../../../lib/google-auth";
import {readReceipt} from "../../../../lib/receipt-storage";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return Response.redirect(new URL("/area-riservata?sessione=scaduta",request.url),303);
  const {id}=await params;
  const metadata=await getPaymentReceipt(id);
  if(!metadata)return Response.json({message:"Ricevuta non trovata."},{status:404});
  const stored=await readReceipt(metadata.key);
  if(!stored)return Response.json({message:"File non trovato."},{status:404});
  return new Response(stored.body,{headers:{"Content-Type":metadata.contentType||stored.contentType,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
