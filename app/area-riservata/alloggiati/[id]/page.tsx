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
  if(!item||item.status!=="checked_in")return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Scheda non disponibile</h1><p>Completa il check-in prima di preparare il test Alloggiati Web.</p><Link className="button" href="/area-riservata">Torna alle richieste</Link></section></main>;
  const [draft,lookups]=await Promise.all([getCheckinSubmission(id),listAlloggiatiLookupValues()]);
  if(!draft)return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Check-in incompleto</h1><Link className="button" href={`/area-riservata/checkin/${id}`}>Completa il check-in</Link></section></main>;
  let preview;try{preview=buildAlloggiatiRecords(item.arrivalDate,item.departureDate,draft as AlloggiatiDraft,lookups);}catch(error){return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>Dati da correggere</h1><p>{error instanceof Error?error.message:"Non è possibile generare le schedine."}</p><Link className="button" href={`/area-riservata/checkin/${id}`}>Modifica il check-in</Link></section></main>;}
  const accountMode=(process.env["ALLOGGIATI_ACCOUNT_MODE"]||"standard")==="apartments"?"apartments" as const:"standard" as const;
  const apartments=lookups.filter(row=>row.tableName==="ListaAppartamenti").map(row=>({id:row.itemKey,label:`${row.itemValue} · ${row.itemKey}`}));
  const defaultApartmentId=(process.env["ALLOGGIATI_APARTMENT_ID"]||"").trim();
  const configured=Boolean(process.env["ALLOGGIATI_USER"]?.trim()&&process.env["ALLOGGIATI_PASSWORD"]?.trim()&&process.env["ALLOGGIATI_WSKEY"]?.trim()&&(accountMode==="standard"||defaultApartmentId||apartments.length));
  return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><AlloggiatiTestForm requestId={id} guestName={item.name} arrivalDate={item.arrivalDate} departureDate={item.departureDate} preview={preview} accountMode={accountMode} apartments={apartments} defaultApartmentId={defaultApartmentId} configured={configured} initialState={draft.state} initialError={draft.lastError}/></main>;
}
