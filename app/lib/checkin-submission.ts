import type { AvailabilityRecord } from "../../db/availability";

const languages = new Set(["it", "en", "fr", "es", "de"]);
const personFields = ["name", "surname", "birth", "sex", "citizenship", "birthCountry", "birthPlace"];
const leadFields = [...personFields, "documentType", "documentNumber", "issuePlace"];

type CheckinData = { guestCount?:unknown; language?:unknown; values?:unknown; privacyAccepted?:unknown } | null;

export function prepareCheckinSubmission(data:CheckinData,item:AvailabilityRecord){
  if(!data||data.guestCount!==item.guestCount||typeof data.language!=="string"||!languages.has(data.language)||data.privacyAccepted!==true||!data.values||typeof data.values!=="object")return {error:"Controlla i dati del check-in."};
  const values=sanitizeValues(data.values as Record<string,unknown>);
  if(values["arrival-date"]!==item.arrivalDate||values["departure-date"]!==item.departureDate||!required(values,"lead",leadFields)||!values["arrival-time"]||!values.transport)return {error:"Completa tutti i dati richiesti."};
  for(let index=1;index<item.guestCount;index++)if(!required(values,`guest-${index}`,personFields))return {error:"Completa i dati di tutti gli ospiti."};
  const submittedAt=new Date().toISOString();
  return {saved:JSON.stringify({language:data.language,guestCount:item.guestCount,values,privacyAcceptedAt:submittedAt})};
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
