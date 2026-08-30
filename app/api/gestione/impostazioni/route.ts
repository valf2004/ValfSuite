import {headers} from "next/headers";
import {getEnvironmentSettingsSummary,saveEnvironmentSettings} from "../../../lib/environment-settings";
import {privateUserFromCookie} from "../../../lib/google-auth";
export const dynamic="force-dynamic";
async function authenticatedUser(){const requestHeaders=await headers();return privateUserFromCookie(requestHeaders.get("cookie"));}
export async function GET(){const user=await authenticatedUser();if(!user)return Response.json({error:"unauthorized"},{status:401});return Response.json({settings:await getEnvironmentSettingsSummary()});}
export async function PUT(request:Request){const user=await authenticatedUser();if(!user)return Response.json({error:"unauthorized"},{status:401});try{return Response.json({settings:await saveEnvironmentSettings(await request.json())});}catch(error){return Response.json({error:error instanceof Error?error.message:"Impossibile salvare le impostazioni."},{status:400});}}
