import {replaceAlloggiatiLookupTable,type AlloggiatiLookupInput} from "../../db/alloggiati-lookups";

const endpoint="https://alloggiatiweb.poliziadistato.it/service/service.asmx";
const tableNames=["Luoghi","Tipi_Documento","Tipi_Alloggiato","TipoErrore"] as const;

export type AlloggiatiTestResult={success:boolean;validCount:number;totalCount:number;generalError:string;details:Array<{success:boolean;errorCode:string;errorDescription:string;errorDetail:string}>};

export async function syncAlloggiatiTables(){
  const user=required("ALLOGGIATI_USER"),password=required("ALLOGGIATI_PASSWORD"),wsKey=required("ALLOGGIATI_WSKEY");
  const token=await generateToken(user,password,wsKey);const requested:string[]=[...tableNames];
  if((process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments")requested.push("ListaAppartamenti");
  const summaries=[];for(const tableName of requested){const csv=await downloadTable(user,token,tableName);const items=parseLookupCsv(csv);if(!items.length)throw new Error(`La tabella ${tableName} non contiene righe importabili.`);summaries.push(await replaceAlloggiatiLookupTable(tableName,items));}
  return summaries;
}

export async function testAlloggiatiRecords(records:string[],apartmentId?:string):Promise<AlloggiatiTestResult>{
  if(!records.length)throw new Error("Non ci sono schedine da verificare.");
  const user=required("ALLOGGIATI_USER"),password=required("ALLOGGIATI_PASSWORD"),wsKey=required("ALLOGGIATI_WSKEY");
  const token=await generateToken(user,password,wsKey);const mode=(process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments"?"apartments":"standard";
  const action=mode==="apartments"?"GestioneAppartamenti_Test":"Test";
  const apartment=mode==="apartments"?(apartmentId||process.env["ALLOGGIATI_APARTMENT_ID"]||"").trim():"";
  if(mode==="apartments"&&!/^\d+$/.test(apartment))throw new Error("Seleziona un appartamento valido prima del test.");
  const list=records.map(record=>`<string>${xml(record)}</string>`).join("");
  const apartmentTag=mode==="apartments"?`<IdAppartamento>${xml(apartment)}</IdAppartamento>`:"";
  const body=`<${action} xmlns="AlloggiatiService"><Utente>${xml(user)}</Utente><token>${xml(token)}</token><ElencoSchedine>${list}</ElencoSchedine>${apartmentTag}</${action}>`;
  return parseTestResponse(await soap(action,body),action,records.length);
}

async function generateToken(user:string,password:string,wsKey:string){
  const body=`<GenerateToken xmlns="AlloggiatiService"><Utente>${xml(user)}</Utente><Password>${xml(password)}</Password><WsKey>${xml(wsKey)}</WsKey></GenerateToken>`;
  const response=await soap("GenerateToken",body);const token=tag(response,"token");if(!token)throw new Error(serviceError(response)||"Alloggiati Web non ha restituito un token.");return token;
}
async function downloadTable(user:string,token:string,tableName:string){
  const body=`<Tabella xmlns="AlloggiatiService"><Utente>${xml(user)}</Utente><token>${xml(token)}</token><tipo>${xml(tableName)}</tipo></Tabella>`;
  const response=await soap("Tabella",body);const csv=tag(response,"CSV");if(!csv)throw new Error(serviceError(response)||`La tabella ${tableName} è vuota.`);return csv;
}
async function soap(action:string,body:string){
  const envelope=`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`;
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"text/xml; charset=utf-8",SOAPAction:`"AlloggiatiService/${action}"`},body:envelope,signal:AbortSignal.timeout(20000)});
  const text=await response.text();if(!response.ok)throw new Error(`Alloggiati Web ha risposto con HTTP ${response.status}.`);return text;
}

export function parseLookupCsv(input:string):AlloggiatiLookupInput[]{
  const normalized=input.replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim();if(!normalized)return [];
  const firstLine=normalized.split("\n",1)[0];const delimiter=firstLine.includes(";")?";":",";
  const rows=normalized.split("\n").map(line=>csvRow(line,delimiter)).filter(row=>row.some(Boolean));const headers=rows.shift()?.map(value=>value.trim())||[];
  return rows.filter(row=>row[0]?.trim()).map(row=>({itemKey:row[0].trim(),itemValue:(row[1]||row[0]).trim(),metadata:Object.fromEntries(headers.slice(2).map((header,index)=>[header||`field_${index+3}`,(row[index+2]||"").trim()]))}));
}
function csvRow(line:string,delimiter:string){const values:string[]=[];let value="",quoted=false;for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){value+='"';index++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){values.push(value);value="";}else value+=char;}values.push(value);return values;}
function tag(xmlText:string,name:string){const match=xmlText.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,"i"));return match?decodeXml(match[1].trim()):"";}
function serviceError(response:string){return tag(response,"ErroreDes")||tag(response,"ErroreDettaglio");}
function parseTestResponse(response:string,action:string,totalCount:number):AlloggiatiTestResult{
  const resultBlock=block(response,`${action}Result`);const generalSuccess=/^(true|1)$/i.test(tag(resultBlock,"esito"));
  const generalError=[tag(resultBlock,"ErroreCod"),tag(resultBlock,"ErroreDes"),tag(resultBlock,"ErroreDettaglio")].filter(Boolean).join(" · ");
  const details=blocks(block(response,"Dettaglio"),"EsitoOperazioneServizio").map(item=>({success:/^(true|1)$/i.test(tag(item,"esito")),errorCode:tag(item,"ErroreCod"),errorDescription:tag(item,"ErroreDes"),errorDetail:tag(item,"ErroreDettaglio")}));
  const validCount=Number.parseInt(tag(response,"SchedineValide"),10)||0;
  return {success:generalSuccess&&validCount===totalCount&&details.every(item=>item.success),validCount,totalCount,generalError,details};
}
function block(xmlText:string,name:string){const match=xmlText.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,"i"));return match?.[1]||"";}
function blocks(xmlText:string,name:string){return [...xmlText.matchAll(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,"gi"))].map(match=>match[1]);}
function xml(value:string){return value.replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]||char));}
function decodeXml(value:string){return value.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");}
function required(key:string){const value=process.env[key]?.trim();if(!value)throw new Error(`Configura ${key} nelle impostazioni prima della sincronizzazione.`);return value;}
