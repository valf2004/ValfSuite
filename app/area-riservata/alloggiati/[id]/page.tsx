import type {Metadata} from "next";
import Link from "next/link";
import {headers} from "next/headers";
import {getCheckinSubmission,listAvailabilityRequests} from "../../../../db/availability";
import {listAlloggiatiLookupValues} from "../../../../db/alloggiati-lookups";
import {PrivateHeader,PrivateLogin} from "../../../area-privata/PrivateChrome";
import {AlloggiatiTestForm} from "../../../area-privata/AlloggiatiTestForm";
import {authIsConfigured,privateUserFromCookie} from "../../../lib/google-auth";
import {buildAlloggiatiRecords,type AlloggiatiDraft} from "../../../lib/alloggiati-record";

export const metadata:Metadata={title:"Test Alloggiati Web | VALF Suite",robots:{index:false,follow:false}};

export default async function AlloggiatiPage({params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||!["checked_in","police_registered"].includes(item.status))return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Scheda non disponibile</h1><p>Completa il check-in prima di preparare il test Alloggiati Web.</p><Link className="button" href="/area-riservata">Torna alle richieste</Link></section></main>;
  const [draft,lookups]=await Promise.all([getCheckinSubmission(id),listAlloggiatiLookupValues()]);
  if(!draft)return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Check-in incompleto</h1><Link className="button" href={`/area-riservata/checkin/${id}`}>Completa il check-in</Link></section></main>;
  let preview;try{preview=buildAlloggiatiRecords(item.arrivalDate,item.departureDate,draft as AlloggiatiDraft,lookups);}catch(error){return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Dati da correggere</h1><p>{error instanceof Error?error.message:"Non è possibile generare le schedine."}</p><Link className="button" href={`/area-riservata/checkin/${id}`}>Modifica il check-in</Link></section></main>;}
  const accountMode=(process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments"?"apartments" as const:"standard" as const;
  const apartments=lookups.filter(row=>row.tableName==="ListaAppartamenti").map(row=>({id:row.itemKey,label:`${row.itemValue} · ${row.itemKey}`}));
  const defaultApartmentId=(process.env["ALLOGGIATI_APARTMENT_ID"]||"").trim();
  const configured=Boolean(process.env["ALLOGGIATI_USER"]?.trim()&&process.env["ALLOGGIATI_PASSWORD"]?.trim()&&process.env["ALLOGGIATI_WSKEY"]?.trim()&&(accountMode==="standard"||defaultApartmentId||apartments.length));
  const receipt=receiptAvailability(draft.sendAttemptedAt);
  return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><AlloggiatiTestForm requestId={id} guestName={item.name} arrivalDate={item.arrivalDate} departureDate={item.departureDate} preview={preview} accountMode={accountMode} apartments={apartments} defaultApartmentId={defaultApartmentId} configured={configured} initialState={draft.state} initialError={draft.lastError} initialValidatedApartmentId={draft.validatedApartmentId} initialSendAttemptedAt={draft.sendAttemptedAt} receiptDate={receipt.date} receiptStatus={receipt.status}/></main>;
}

function receiptAvailability(attemptedAt?:string|null):{date:string;status:"available"|"pending"|"expired"|"missing"}{
  if(!attemptedAt)return {date:"",status:"missing"};const zone="Europe/Rome";const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"});const date=formatter.format(new Date(attemptedAt)),today=formatter.format(new Date());const age=Math.round((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${date}T12:00:00Z`))/86_400_000);return {date,status:age<1?"pending":age>30?"expired":"available"};
}
