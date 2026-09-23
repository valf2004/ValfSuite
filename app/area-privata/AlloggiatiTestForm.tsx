"use client";

import {useState} from "react";
import Link from "next/link";
import {authenticatedFetch} from "./authenticated-fetch";
import type {AlloggiatiRecordPreview} from "../lib/alloggiati-record";

type Apartment={id:string;label:string};
type TestResult={success:boolean;validCount:number;totalCount:number;message:string;details:Array<{row:number;success:boolean;message:string}>;testedAt:string};

export function AlloggiatiTestForm({requestId,guestName,arrivalDate,departureDate,preview,accountMode,apartments,defaultApartmentId,configured,initialState,initialError}:{requestId:string;guestName:string;arrivalDate:string;departureDate:string;preview:AlloggiatiRecordPreview;accountMode:"standard"|"apartments";apartments:Apartment[];defaultApartmentId:string;configured:boolean;initialState:string;initialError?:string|null}){
  const [apartmentId,setApartmentId]=useState(defaultApartmentId);const [testing,setTesting]=useState(false);const [result,setResult]=useState<TestResult|null>(null);const [error,setError]=useState(initialError||"");
  async function runTest(){
    setTesting(true);setError("");setResult(null);
    try{
      const response=await authenticatedFetch(`/api/gestione/alloggiati/test/${requestId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apartmentId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok&&response.status!==422)throw new Error(data.error||"Test Alloggiati non riuscito.");
      setResult(data as TestResult);if(!data.success)setError(data.message||"Una o più schedine non sono valide.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Test Alloggiati non riuscito.");}
    finally{setTesting(false);}
  }
  return <section className="alloggiati-workspace">
    <header className="alloggiati-title"><div><p className="eyebrow">Alloggiati Web · controllo preliminare</p><h1>Scheda precompilata</h1><p>I dati provengono dal check-in registrato. Il test non acquisisce le schedine e non modifica lo stato della prenotazione.</p></div><span className={initialState==="validated"?"validated":"ready"}>{initialState==="validated"?"Test già superato":"Da verificare"}</span></header>
    <div className="alloggiati-summary"><div><small>Prenotazione</small><strong>{guestName}</strong><span>{requestId}</span></div><div><small>Soggiorno</small><strong>{formatDate(arrivalDate)} – {formatDate(departureDate)}</strong><span>{preview.stayDays} {preview.stayDays===1?"giorno":"giorni"}</span></div><div><small>Schedine</small><strong>{preview.rows.length}</strong><span>{accountMode==="apartments"?"Gestione appartamenti":"Struttura singola"}</span></div></div>
    {accountMode==="apartments"&&<label className="alloggiati-apartment">Appartamento<select value={apartmentId} onChange={event=>setApartmentId(event.target.value)} required><option value="">Seleziona</option>{apartments.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select><span>L’elenco proviene dalla tabella ufficiale importata nelle impostazioni.</span></label>}
    <div className="alloggiati-table-wrap"><table className="alloggiati-table"><thead><tr><th>#</th><th>Tipo</th><th>Ospite</th><th>Nascita</th><th>Documento</th><th>Tracciato</th></tr></thead><tbody>{preview.rows.map(row=><tr key={row.ordinal}><td>{row.ordinal+1}</td><td>{guestType(row.guestType)}</td><td>{row.name}</td><td>{formatDate(row.birth)}</td><td>{row.document}</td><td><code title={row.record}>{row.record.length} caratteri</code></td></tr>)}</tbody></table></div>
    <details className="alloggiati-records"><summary>Mostra anteprima tecnica del tracciato</summary>{preview.rows.map(row=><pre key={row.ordinal}><span>Riga {row.ordinal+1}</span>{row.record}</pre>)}</details>
    {!configured&&<p className="alloggiati-notice warning" role="alert">Configura utente, password e WSKEY Alloggiati Web nelle impostazioni della VM prima di eseguire il test.</p>}
    {result?.success&&<div className="alloggiati-result success" role="status"><strong>Test superato</strong><span>{result.validCount} di {result.totalCount} schedine valide · {formatDateTime(result.testedAt)}</span><p>{result.message}</p></div>}
    {error&&<div className="alloggiati-result error" role="alert"><strong>Test non superato</strong><p>{error}</p>{result?.details?.some(item=>!item.success)&&<ul>{result.details.filter(item=>!item.success).map(item=><li key={item.row}>Riga {item.row}: {item.message||"dato non valido"}</li>)}</ul>}</div>}
    <div className="alloggiati-actions"><Link href={`/area-riservata/checkin/${requestId}`}>Modifica dati del check-in</Link><Link href={`/area-riservata/ross1000/${requestId}`}>Esporta XML Ross1000</Link><Link href="/area-riservata">Torna alle richieste</Link><button type="button" className="button" disabled={testing||!configured||(accountMode==="apartments"&&!apartmentId)} onClick={runTest}>{testing?"Verifica in corso…":"Invia test"}</button><button type="button" disabled title="L’invio reale sarà attivato in una fase successiva">Invio reale · non attivo</button></div>
  </section>;
}

function guestType(value:string){return value==="16"?"Ospite singolo":value==="17"?"Capofamiglia":value==="18"?"Capogruppo":value==="19"?"Familiare":"Membro gruppo";}
function formatDate(value:string){const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("it-IT").format(date);}
function formatDateTime(value:string){return new Intl.DateTimeFormat("it-IT",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
