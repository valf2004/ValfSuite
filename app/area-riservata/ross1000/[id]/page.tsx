import type {Metadata} from "next";
import Link from "next/link";
import {headers} from "next/headers";
import {getCheckinSubmission,listAvailabilityRequests} from "../../../../db/availability";
import {PrivateHeader,PrivateLogin} from "../../../area-privata/PrivateChrome";
import {authIsConfigured,privateUserFromCookie} from "../../../lib/google-auth";
import {buildRoss1000Xml} from "../../../lib/ross1000-xml.mjs";

export const metadata:Metadata={title:"XML Ross1000 | VALF Suite",robots:{index:false,follow:false}};

export default async function Ross1000Page({params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  const {id}=await params;const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||item.status!=="checked_in")return <Unavailable user={user} title="XML non disponibile" message="Completa il check-in prima di produrre il file Ross1000."/>;
  const draft=await getCheckinSubmission(id);
  if(!draft)return <Unavailable user={user} title="Check-in incompleto" message="Completa i dati degli ospiti prima di produrre il file XML." edit={id}/>;
  let preview;
  try{preview=buildRoss1000Xml({requestId:id,arrivalDate:item.arrivalDate,draft,structureCode:process.env["ROSS1000_STRUCTURE_CODE"]||"L12648",product:process.env["ROSS1000_PRODUCT"]||"VALF Suite",availableUnits:Number(process.env["ROSS1000_AVAILABLE_UNITS"]||1),availableBeds:Number(process.env["ROSS1000_AVAILABLE_BEDS"]||4)});}
  catch(error){return <Unavailable user={user} title="Dati da completare" message={error instanceof Error?error.message:"Non è possibile produrre l’XML."} edit={id}/>;}
  return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-workspace ross-workspace">
    <header className="alloggiati-title"><div><p className="eyebrow">Ross1000 · esportazione gestionale</p><h1>XML pronto</h1><p>Il file contiene il movimento del giorno di arrivo e i dati del check-in. In questa fase non viene trasmesso automaticamente.</p></div><span className="validated">Controlli superati</span></header>
    <div className="alloggiati-summary"><div><small>Struttura</small><strong>VALF Suite · L12648</strong><span>CIR 011002-LT-0278</span></div><div><small>Movimento</small><strong>{formatDate(item.arrivalDate)}</strong><span>1 unità · 4 letti disponibili</span></div><div><small>Arrivi</small><strong>{preview.arrivals.length}</strong><span>{item.name}</span></div></div>
    <section className="ross-validation"><h2>Verifica del formato</h2><div>{preview.validation.checks.map((check:string)=><p key={check}><span>✓</span>{check}</p>)}</div><small>La verifica definitiva si effettua caricando questo file nella funzione “Importa file gestionale” di Ross1000. Il Web Service non espone un invio di prova.</small></section>
    <details className="alloggiati-records ross-xml"><summary>Mostra anteprima XML</summary><pre>{preview.xml}</pre></details>
    <div className="alloggiati-actions"><Link href={`/area-riservata/checkin/${id}`}>Modifica dati del check-in</Link><Link href="/area-riservata">Torna alle richieste</Link><a className="button" href={`/api/gestione/ross1000/xml/${id}`}>Scarica XML</a><button type="button" disabled title="L’invio automatico sarà attivato dopo la verifica del file">Invio automatico · non attivo</button></div>
  </section></main>;
}

function Unavailable({user,title,message,edit}:{user:{email:string;name?:string|null;picture?:string|null};title:string;message:string;edit?:string}){return <main className="dashboard-page"><PrivateHeader user={user} active="requests"/><section className="alloggiati-unavailable"><h1>{title}</h1><p>{message}</p><Link className="button" href={edit?`/area-riservata/checkin/${edit}`:"/area-riservata"}>{edit?"Modifica il check-in":"Torna alle richieste"}</Link></section></main>;}
function formatDate(value:string){return new Intl.DateTimeFormat("it-IT").format(new Date(`${value}T00:00:00`));}
