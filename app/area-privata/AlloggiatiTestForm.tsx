"use client";

import {useRef,useState} from "react";
import Link from "next/link";
import {authenticatedFetch} from "./authenticated-fetch";
import type {AlloggiatiRecordPreview} from "../lib/alloggiati-record";

type Apartment={id:string;label:string};
type OperationResult={success:boolean;validCount:number;totalCount:number;message:string;details:Array<{row:number;success:boolean;message:string}>;testedAt?:string;attemptedAt?:string;documentsDeleted?:boolean};

export function AlloggiatiTestForm({requestId,guestName,arrivalDate,departureDate,preview,accountMode,apartments,defaultApartmentId,configured,initialState,initialError,initialValidatedApartmentId,initialSendAttemptedAt,receiptDate,receiptStatus="missing"}:{requestId:string;guestName:string;arrivalDate:string;departureDate:string;preview:AlloggiatiRecordPreview;accountMode:"standard"|"apartments";apartments:Apartment[];defaultApartmentId:string;configured:boolean;initialState:string;initialError?:string|null;initialValidatedApartmentId?:string|null;initialSendAttemptedAt?:string|null;receiptDate?:string;receiptStatus?:"available"|"pending"|"expired"|"missing"}){
  const [apartmentId,setApartmentId]=useState(initialValidatedApartmentId||defaultApartmentId);
  const [state,setState]=useState(initialState);
  const [testing,setTesting]=useState(false);const [sending,setSending]=useState(false);const [resolving,setResolving]=useState(false);
  const [operation,setOperation]=useState<"test"|"send"|null>(null);const [result,setResult]=useState<OperationResult|null>(null);const [error,setError]=useState(initialError||"");
  const [sendAttemptedAt,setSendAttemptedAt]=useState(initialSendAttemptedAt||"");
  const [activeGuest,setActiveGuest]=useState(0);
  const feedbackRef=useRef<HTMLDivElement>(null);
  const apartmentMissing=accountMode==="apartments"&&!apartmentId;

  function revealFeedback(){window.setTimeout(()=>{feedbackRef.current?.focus({preventScroll:true});feedbackRef.current?.scrollIntoView({behavior:"smooth",block:"center"});},0);}

  async function runTest(){
    setTesting(true);setError("");setResult(null);setOperation("test");
    try{
      const response=await authenticatedFetch(`/api/gestione/alloggiati/test/${requestId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apartmentId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok&&response.status!==422)throw new Error(data.error||"Test Alloggiati non riuscito.");
      setResult(data as OperationResult);setState(data.success?"validated":"error");if(!data.success)setError(data.message||"Una o più schedine non sono valide.");
    }catch(cause){setState("error");setError(cause instanceof Error?cause.message:"Test Alloggiati non riuscito.");}
    finally{setTesting(false);revealFeedback();}
  }

  async function sendReal(){
    if(!window.confirm(`Confermi l’invio definitivo di ${preview.rows.length} schedine ad Alloggiati Web? Dopo l’acquisizione il check-in non sarà più modificabile.`))return;
    setSending(true);setError("");setResult(null);setOperation("send");
    try{
      const response=await authenticatedFetch(`/api/gestione/alloggiati/send/${requestId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apartmentId,confirmation:"INVIO DEFINITIVO"})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){if(data.requiresReconciliation){setSendAttemptedAt(data.attemptedAt||new Date().toISOString());setState("error");setError(data.error||data.message||"L’esito dell’invio deve essere verificato sul portale Alloggiati Web.");setResult(data as OperationResult);return;}throw new Error(data.error||"Invio Alloggiati Web non riuscito.");}
      setResult(data as OperationResult);setSendAttemptedAt(data.attemptedAt||new Date().toISOString());setState("sent");
    }catch(cause){setError(cause instanceof Error?cause.message:"Invio Alloggiati Web non riuscito.");}
    finally{setSending(false);revealFeedback();}
  }

  async function resolveAttempt(resolution:"received"|"not_received"){
    const received=resolution==="received";const question=received?"Confermi di aver verificato sul portale che tutte le schedine risultano acquisite?":"Confermi di aver verificato sul portale che nessuna schedina è stata acquisita? Sarà necessario ripetere il test.";
    if(!window.confirm(question))return;
    setResolving(true);setError("");
    try{
      const response=await authenticatedFetch(`/api/gestione/alloggiati/send/${requestId}/resolve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resolution,confirmation:received?"SCHEDINE ACQUISITE":"NESSUNA SCHEDINA"})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Riconciliazione non riuscita.");
      if(received){setState("sent");setResult({success:true,validCount:preview.rows.length,totalCount:preview.rows.length,message:"Invio registrato dopo la verifica manuale sul portale.",details:[],documentsDeleted:data.documentsDeleted});}
      else{setState("ready");setSendAttemptedAt("");setResult(null);setOperation(null);}
    }catch(cause){setError(cause instanceof Error?cause.message:"Riconciliazione non riuscita.");}
    finally{setResolving(false);revealFeedback();}
  }

  const statusLabel=state==="sent"?"Invio completato":sendAttemptedAt?"Esito da verificare":state==="validated"?"Test superato":"Da verificare";
  const activeRow=preview.rows.find(row=>row.ordinal===activeGuest)||preview.rows[0];
  const currentReceiptStatus=state==="sent"&&receiptStatus==="missing"&&sendAttemptedAt?"pending":receiptStatus;
  const currentReceiptDate=receiptDate||dateInRome(sendAttemptedAt);
  const successfulResult=result?.success?result:state==="sent"?{success:true,validCount:preview.rows.length,totalCount:preview.rows.length,message:"La pratica risulta acquisita da Alloggiati Web.",details:[]}:null;
  return <section className="alloggiati-workspace">
    <header className="alloggiati-title"><div><p className="eyebrow">Alloggiati Web · controllo e invio</p><h1>Scheda precompilata</h1><p>I dati provengono dal check-in. Prima esegui il test ufficiale; solo la stessa versione validata può essere inviata definitivamente.</p></div><span className={state==="sent"||state==="validated"?"validated":sendAttemptedAt?"warning":"ready"}>{statusLabel}</span></header>
    <div className="alloggiati-summary"><div><small>Prenotazione</small><strong>{guestName}</strong><span>{requestId}</span></div><div><small>Soggiorno</small><strong>{formatDate(arrivalDate)} – {formatDate(departureDate)}</strong><span>{preview.stayDays} {preview.stayDays===1?"giorno":"giorni"}</span></div><div><small>Schedine</small><strong>{preview.rows.length}</strong><span>{accountMode==="apartments"?"Gestione appartamenti":"Struttura singola"}</span></div></div>
    {accountMode==="apartments"&&<label className="alloggiati-apartment">Appartamento<select value={apartmentId} onChange={event=>setApartmentId(event.target.value)} required disabled={Boolean(sendAttemptedAt)||state==="sent"}><option value="">Seleziona</option>{apartments.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select><span>L’elenco proviene dalla tabella ufficiale importata nelle impostazioni.</span></label>}
    <div className="alloggiati-table-wrap"><table className="alloggiati-table"><thead><tr><th>#</th><th>Tipo</th><th>Ospite</th><th>Nascita</th><th>Documento</th><th>Tracciato</th></tr></thead><tbody>{preview.rows.map(row=><tr key={row.ordinal} className={activeRow?.ordinal===row.ordinal?"active":""} tabIndex={0} onMouseEnter={()=>setActiveGuest(row.ordinal)} onFocus={()=>setActiveGuest(row.ordinal)} onClick={()=>setActiveGuest(row.ordinal)} aria-label={`Mostra il riepilogo di ${row.name}`}><td>{row.ordinal+1}</td><td>{guestType(row.guestType)}</td><td>{row.name}</td><td>{formatDate(row.birth)}</td><td>{row.document}</td><td><code title={row.record}>{row.record.length} caratteri</code></td></tr>)}</tbody></table></div>
    {activeRow&&<aside className="alloggiati-guest-card" aria-live="polite"><header><div><small>Riepilogo alloggiato {activeRow.ordinal+1}</small><strong>{activeRow.name}</strong></div><span>Passa sulle righe o toccale per cambiare ospite</span></header><dl>{activeRow.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl></aside>}
    <details className="alloggiati-records"><summary>Mostra anteprima tecnica del tracciato</summary>{preview.rows.map(row=><pre key={row.ordinal}><span>Riga {row.ordinal+1}</span>{row.record}</pre>)}</details>
    {!configured&&<p className="alloggiati-notice warning" role="alert">Configura utente, password e WSKEY Alloggiati Web nelle impostazioni della VM prima di eseguire il test.</p>}
    {sendAttemptedAt&&state!=="sent"&&<div className="alloggiati-reconciliation" role="alert"><strong>Invio bloccato per sicurezza</strong><p>Un invio reale è stato tentato il {formatDateTime(sendAttemptedAt)}, ma l’acquisizione completa non è confermata. Non ripetere l’invio: verifica prima la presenza delle schedine sul portale Alloggiati Web. Se ne risultano acquisite solo alcune, completa manualmente le mancanti sul portale e conferma soltanto quando sono presenti tutte.</p><div><button type="button" disabled={resolving} onClick={()=>resolveAttempt("received")}>Tutte le schedine risultano acquisite</button><button type="button" disabled={resolving} onClick={()=>resolveAttempt("not_received")}>Nessuna schedina acquisita</button></div></div>}
    <div className="alloggiati-feedback" ref={feedbackRef} tabIndex={-1} aria-live="assertive">
      {successfulResult&&<div className="alloggiati-result success" role="status"><strong>{state==="sent"?"Invio riuscito: schedine acquisite":"Test superato"}</strong><span>{successfulResult.validCount} di {successfulResult.totalCount} schedine {state==="sent"?"acquisite":"valide"}{state==="sent"&&sendAttemptedAt?` · ${formatDateTime(sendAttemptedAt)}`:successfulResult.testedAt?` · ${formatDateTime(successfulResult.testedAt)}`:""}</span><p>{successfulResult.message}</p>{state==="sent"&&<p>La prenotazione è stata spostata in <strong>Questura registrata</strong>. La ricevuta ufficiale sarà disponibile dal giorno successivo.</p>}{state==="sent"&&successfulResult.documentsDeleted===false&&<p>Attenzione: le copie dei documenti non sono state eliminate automaticamente; cancellale dall’area riservata.</p>}</div>}
      {error&&<div className="alloggiati-result error" role="alert"><strong>{sendAttemptedAt?"Esito da verificare":operation==="send"?"Invio non completato":"Test non superato"}</strong><p>{error}</p>{result?.details?.some(item=>!item.success)&&<ul>{result.details.filter(item=>!item.success).map(item=><li key={item.row}>Riga {item.row}: {item.message||"dato non valido"}</li>)}</ul>}</div>}
    </div>
    {state==="sent"&&<div className={`alloggiati-receipt ${currentReceiptStatus}`}><strong>Ricevuta ufficiale Alloggiati Web</strong>{currentReceiptStatus==="available"?<><span>Invio del {formatDate(currentReceiptDate)} · PDF disponibile</span><a className="button" href={`/api/gestione/alloggiati/ricevuta/${requestId}`}>Scarica ricevuta PDF</a></>:currentReceiptStatus==="pending"?<span>La ricevuta dell’invio del {formatDate(currentReceiptDate)} sarà scaricabile dal giorno successivo.</span>:currentReceiptStatus==="expired"?<span>La finestra di download di 30 giorni per l’invio del {formatDate(currentReceiptDate)} è terminata.</span>:<span>La data dell’invio non è disponibile per questa pratica.</span>}</div>}
    <div className="alloggiati-actions">{state==="sent"?<span className="alloggiati-sent-inline">✓ Invio acquisito da Alloggiati Web</span>:sendAttemptedAt?<span>Modifica check-in bloccata</span>:<button type="button" className="alloggiati-edit-link" onClick={()=>window.location.assign(`/area-riservata/checkin/${requestId}`)}>Modifica dati del check-in</button>}<Link href={`/area-riservata/ross1000/${requestId}`}>Esporta XML Ross1000</Link><Link href="/area-riservata">Torna alle richieste</Link><button type="button" className="button" disabled={testing||sending||resolving||!configured||apartmentMissing||Boolean(sendAttemptedAt)||state==="sent"} onClick={runTest}>{testing?"Verifica in corso…":"Invia test"}</button><button type="button" className="button alloggiati-send" disabled={testing||sending||resolving||!configured||apartmentMissing||Boolean(sendAttemptedAt)||state!=="validated"} onClick={sendReal}>{state==="sent"?"Invio completato":sending?"Invio in corso…":"Invia definitivamente"}</button></div>
  </section>;
}

function guestType(value:string){return value==="16"?"Ospite singolo":value==="17"?"Capofamiglia":value==="18"?"Capogruppo":value==="19"?"Familiare":"Membro gruppo";}
function formatDate(value:string){const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("it-IT").format(date);}
function formatDateTime(value:string){return new Intl.DateTimeFormat("it-IT",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
function dateInRome(value:string){return value?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)):"";}
