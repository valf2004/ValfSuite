import {headers} from "next/headers";
import {privateUserFromCookie} from "../../../../lib/google-auth";

const guideFiles:Record<string,string>={
  it:"VALF_Suite_Guida_Ospiti_IT.pdf",
  en:"VALF_Suite_Guida_Ospiti_EN.pdf",
  fr:"VALF_Suite_Guida_Ospiti_FR.pdf",
  es:"VALF_Suite_Guida_Ospiti_ES.pdf",
  de:"VALF_Suite_Guida_Ospiti_DE.pdf",
};

export async function GET(_request:Request,{params}:{params:Promise<{lang:string}>}){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return new Response(null,{status:303,headers:{Location:"/area-riservata?sessione=scaduta"}});
  const {lang}=await params;
  const filename=guideFiles[lang.toLowerCase()];
  if(!filename)return Response.json({message:"Lingua non disponibile."},{status:404});
  const directory=process.env.GUEST_GUIDES_DIR?.trim();
  if(!directory)return Response.json({message:"Guide disponibili sulla VM di VALF Suite."},{status:404});
  const [{readFile},path]=await Promise.all([import("node:fs/promises"),import("node:path")]);
  try{
    const body=new Uint8Array(await readFile(path.join(directory,filename)));
    return new Response(body,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    if((error as {code?:string}).code==="ENOENT")return Response.json({message:"Guida non trovata."},{status:404});
    throw error;
  }
}
