"use client";

import {useEffect, useRef, useState} from "react";
import {parseStayPrice} from "../lib/stay-price.mjs";

export function StayPriceEditor({value, disabled, onSave}:{value:number|null;disabled:boolean;onSave:(amount:string,previousAmountCents:number|null)=>Promise<void>}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState("");
  const [previous,setPrevious]=useState<number|null>(null);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
  function edit(){setDraft(value==null?"":(value/100).toFixed(2).replace(".",","));setPrevious(value);setError("");setEditing(true);}
  async function save(){
    if(saving||disabled)return;
    if(parseStayPrice(draft)==null){setError("Inserisci un importo valido, ad esempio 450,00.");input.current?.focus();return;}
    setSaving(true);setError("");
    try{await onSave(draft,previous);setEditing(false);}catch(error){setError(error instanceof Error?error.message:"Salvataggio non riuscito. Riprova.");}
    finally{setSaving(false);}
  }
  return <span className="stay-price-editor">
    {editing?<input ref={input} className="stay-price-input" aria-label="Prezzo totale concordato in euro" aria-invalid={Boolean(error)} inputMode="decimal" value={draft} disabled={saving} onChange={event=>{setDraft(event.target.value);setError("");}} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void save();}if(event.key==="Escape"&&!saving){setEditing(false);setError("");}}}/>:<strong title="Prezzo totale concordato">{value==null?"Importo non indicato":new Intl.NumberFormat("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100)}</strong>}
    <button type="button" className="stay-price-action" disabled={disabled||saving} title={editing?"Conferma importo (Invio); Esc per annullare":"Modifica prezzo totale concordato"} aria-label={editing?"Conferma prezzo totale concordato":"Modifica prezzo totale concordato"} onClick={()=>editing?void save():edit()}>{editing?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>:<span aria-hidden="true">€</span>}</button>
    {error&&<span className="stay-price-error" role="alert">{error}</span>}
  </span>;
}
