import type {AlloggiatiLookupValue} from "../../db/alloggiati-lookups";

export type AlloggiatiDraft={state:string;language:string;guestCount:number;groupType:"single"|"family"|"group";version:number;values:Record<string,string>;lastError?:string|null};
export type AlloggiatiRecordPreview={records:string[];rows:Array<{ordinal:number;guestType:string;name:string;birth:string;document:string;record:string}>;stayDays:number};

const italyCode="100000100";

export function buildAlloggiatiRecords(arrivalDate:string,departureDate:string,draft:AlloggiatiDraft,lookups:AlloggiatiLookupValue[]):AlloggiatiRecordPreview{
  const stayDays=daysBetween(arrivalDate,departureDate);if(stayDays<1||stayDays>30)throw new Error("Alloggiati Web accetta soggiorni da 1 a 30 giorni.");
  const arrival=formatDate(arrivalDate);const byKey=new Map(lookups.filter(row=>row.tableName==="Luoghi").map(row=>[row.itemKey,row]));
  const rows=Array.from({length:draft.guestCount},(_,ordinal)=>{
    const prefix=ordinal===0?"lead":`guest-${ordinal}`;const value=(field:string)=>draft.values[`${prefix}-${field}`]?.trim()||"";
    const type=ordinal===0?(draft.groupType==="single"?"16":draft.groupType==="family"?"17":"18"):draft.groupType==="family"?"19":"20";
    const birthCountry=value("birthCountry");const bornInItaly=birthCountry===italyCode;const birthPlace=value("birthPlace");
    if(bornInItaly&&!birthPlace)throw new Error(`Indica il comune di nascita di ${value("name")} ${value("surname")}.`);
    const province=bornInItaly?provinceFor(byKey.get(birthPlace)):"";if(bornInItaly&&!province)throw new Error(`La provincia del comune di nascita di ${value("name")} ${value("surname")} non è disponibile: aggiorna le tabelle Alloggiati.`);
    const documentType=ordinal===0?value("documentType"):"";const documentNumber=ordinal===0?value("documentNumber"):"";const issuePlace=ordinal===0?value("issuePlace"):"";
    const fields=[
      fixed(type,2,"Tipo alloggiato"),fixed(arrival,10,"Data arrivo"),fixed(String(stayDays).padStart(2,"0"),2,"Permanenza"),
      fixed(value("surname"),50,"Cognome"),fixed(value("name"),30,"Nome"),fixed(value("sex"),1,"Sesso"),fixed(formatDate(value("birth")),10,"Data di nascita"),
      fixed(bornInItaly?birthPlace:"",9,"Comune di nascita"),fixed(province,2,"Provincia di nascita"),fixed(birthCountry,9,"Stato di nascita"),
      fixed(value("citizenship"),9,"Cittadinanza"),fixed(documentType,5,"Tipo documento"),fixed(documentNumber,20,"Numero documento"),fixed(issuePlace,9,"Luogo rilascio")
    ];
    const record=fields.join("");if(record.length!==168)throw new Error("Il tracciato generato non misura 168 caratteri.");
    return {ordinal,guestType:type,name:`${value("surname")} ${value("name")}`.trim(),birth:value("birth"),document:ordinal===0?`${documentType} ${documentNumber}`.trim():"—",record};
  });
  return {records:rows.map(row=>row.record),rows,stayDays};
}

function daysBetween(start:string,end:string){const first=Date.parse(`${start}T00:00:00Z`),last=Date.parse(`${end}T00:00:00Z`);return Number.isFinite(first)&&Number.isFinite(last)?Math.round((last-first)/86400000):0;}
function formatDate(value:string){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)throw new Error("Una data del check-in non è valida.");return `${match[3]}/${match[2]}/${match[1]}`;}
function fixed(value:string,length:number,label:string){const clean=value.replace(/[\r\n\t]/g," ").replace(/\s+/g," ").trim().toUpperCase();if(clean.length>length)throw new Error(`${label}: massimo ${length} caratteri.`);return clean.padEnd(length," ");}
function provinceFor(place?:AlloggiatiLookupValue){if(!place)return "";const direct=Object.entries(place.metadata).find(([key,value])=>/prov/i.test(key)&&/^[A-Z]{2}$/i.test(value.trim())&&!/^(EE|ES)$/i.test(value.trim()));if(direct)return direct[1].trim().toUpperCase();return Object.values(place.metadata).map(value=>value.trim().toUpperCase()).find(value=>/^[A-Z]{2}$/.test(value)&&!["EE","ES"].includes(value))||"";}
