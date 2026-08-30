import {headers} from "next/headers";
import {executeReadOnlyQuery,listDatabaseTables} from "../../../../db/database-console";
import {privateUserFromCookie} from "../../../lib/google-auth";
export const dynamic="force-dynamic";
async function authenticatedUser(){const requestHeaders=await headers();return privateUserFromCookie(requestHeaders.get("cookie"));}
export async function GET(){const user=await authenticatedUser();if(!user)return Response.json({error:"unauthorized"},{status:401});return Response.json({tables:await listDatabaseTables()});}
export async function POST(request:Request){const user=await authenticatedUser();if(!user)return Response.json({error:"unauthorized"},{status:401});try{const data=await request.json() as {query?:unknown};if(typeof data.query!=="string")throw new Error("Inserisci una query SELECT.");return Response.json(await executeReadOnlyQuery(data.query));}catch(error){return Response.json({error:error instanceof Error?error.message:"Impossibile eseguire la query."},{status:400});}}
