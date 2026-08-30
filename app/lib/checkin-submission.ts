import type { AvailabilityRecord } from "../../db/availability";
import type {AlloggiatiLookupValue} from "../../db/alloggiati-lookups";

const languages = new Set(["it", "en", "fr", "es", "de"]);
const personFields = ["name", "surname", "birth", "sex", "citizenship", "birthCountry"];
const leadFields = [...personFields, "documentType", "documentNumber", "issuePlace"];

export type CheckinGuestRecord = {
  ordinal:number;alloggiatiType:string;firstName:string;lastName:string;birthDate:string;sexCode:string;
  citizenshipCode:string;birthCountryCode:string;birthPlaceCode:string|null;documentTypeCode:string|null;
  documentNumber:string|null;issuePlaceCode:string|null;
};
export type CheckinSubmissionRecord = {
  language:string;guestCount:number;groupType:"single"|"family"|"group";arrivalTime:string;transport:string;
  arrivalNotes:string;privacyAcceptedAt:string;values:Record<string,string>;guests:CheckinGuestRecord[];
};

type CheckinData = { guestCount?:unknown; language?:unknown; groupType?:unknown; values?:unknown; privacyAccepted?:unknown } | null;

export function prepareCheckinSubmission(data:CheckinData,item:AvailabilityRecord){
  if(!data||data.guestCount!==item.guestCount||typeof data.language!=="string"||!languages.has(data.language)||data.privacyAccepted!==true||!data.values||typeof data.values!=="object")return {error:"Controlla i dati del check-in."};
  const values=sanitizeValues(data.values as Record<string,unknown>);
  if(values["arrival-date"]!==item.arrivalDate||values["departure-date"]!==item.departureDate||!required(values,"lead",leadFields)||!values["arrival-time"]||!values.transport)return {error:"Completa tutti i dati richiesti."};
  for(let index=1;index<item.guestCount;index++)if(!required(values,`guest-${index}`,personFields))return {error:"Completa i dati di tutti gli ospiti."};
  const groupType=item.guestCount===1?"single":data.groupType==="family"||data.groupType==="group"?data.groupType:null;
  if(!groupType)return {error:"Indica se gli ospiti formano una famiglia o un gruppo."};
  const submittedAt=new Date().toISOString();
  const guests=Array.from({length:item.guestCount},(_,ordinal)=>guestRecord(values,ordinal,groupType));
  return {saved:{language:data.language,guestCount:item.guestCount,groupType,arrivalTime:values["arrival-time"],transport:values.transport,arrivalNotes:values["arrival-notes"]||"",values,guests,privacyAcceptedAt:submittedAt} satisfies CheckinSubmissionRecord};
}

export function validateCheckinLookupCodes(submission:CheckinSubmissionRecord,lookups:AlloggiatiLookupValue[]){
  const places=new Set(lookups.filter(row=>row.tableName==="Luoghi").map(row=>row.itemKey));
  const countries=new Set(lookups.filter(row=>row.tableName==="Luoghi"&&Object.values(row.metadata).some(value=>/^(EE|ES)$/i.test(value.trim()))).map(row=>row.itemKey));
  const documents=new Set(lookups.filter(row=>row.tableName==="Tipi_Documento").map(row=>row.itemKey));
  for(const guest of submission.guests){
    if(!["1","2"].includes(guest.sexCode))return "Seleziona il sesso usando i codici previsti da Alloggiati Web.";
    if(countries.size&&(!countries.has(guest.citizenshipCode)||!countries.has(guest.birthCountryCode)))return "Seleziona cittadinanza e Stato di nascita dalla tabella Alloggiati Web.";
    if(places.size&&Boolean(guest.birthPlaceCode&&!places.has(guest.birthPlaceCode)))return "Seleziona il luogo di nascita dalla tabella Alloggiati Web.";
    if(guest.ordinal===0&&places.size&&(!guest.issuePlaceCode||!places.has(guest.issuePlaceCode)))return "Seleziona il luogo di rilascio dalle tabelle Alloggiati Web.";
    if(guest.ordinal===0&&documents.size&&(!guest.documentTypeCode||!documents.has(guest.documentTypeCode)))return "Seleziona il tipo di documento dalla tabella Alloggiati Web.";
  }
  return "";
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
function guestRecord(values:Record<string,string>,ordinal:number,groupType:"single"|"family"|"group"):CheckinGuestRecord{
  const prefix=ordinal===0?"lead":`guest-${ordinal}`;const value=(field:string)=>values[`${prefix}-${field}`]||"";
  const alloggiatiType=ordinal===0?(groupType==="single"?"16":groupType==="family"?"17":"18"):groupType==="family"?"19":"20";
  return {ordinal,alloggiatiType,firstName:value("name"),lastName:value("surname"),birthDate:value("birth"),sexCode:value("sex"),citizenshipCode:value("citizenship"),birthCountryCode:value("birthCountry"),birthPlaceCode:value("birthPlace")||null,documentTypeCode:ordinal===0?value("documentType")||null:null,documentNumber:ordinal===0?value("documentNumber")||null:null,issuePlaceCode:ordinal===0?value("issuePlace")||null:null};
}
