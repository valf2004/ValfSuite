import {headers} from "next/headers";
import {syncAlloggiatiTables} from "../../../../lib/alloggiati-client";
import {privateUserFromCookie} from "../../../../lib/google-auth";
export const dynamic="force-dynamic";
export async function POST(){const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));if(!user)return Response.json({error:"unauthorized"},{status:401});try{return Response.json({tables:await syncAlloggiatiTables()});}catch(error){console.error("alloggiati_table_sync_failed",error instanceof Error?error.message:"unknown");return Response.json({error:error instanceof Error?error.message:"Sincronizzazione non riuscita."},{status:400});}}
