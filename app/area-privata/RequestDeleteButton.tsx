"use client";

import {useRef,useState} from "react";

export function RequestDeleteButton({name,arrival,departure,disabled,onDelete}:{name:string;arrival:string;departure:string;disabled:boolean;onDelete:()=>Promise<void>}){
  const dialog=useRef<HTMLDialogElement>(null);
  const cancel=useRef<HTMLButtonElement>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function confirm(){
    if(saving||disabled)return;
    setSaving(true);setError("");
    try{await onDelete();dialog.current?.close();}
    catch(error){setError(error instanceof Error?error.message:"Eliminazione non riuscita. Riprova.");}
    finally{setSaving(false);}
  }
  return <>
    <button type="button" className="request-delete-action" disabled={disabled} onClick={()=>{setError("");dialog.current?.showModal();cancel.current?.focus();}}>Elimina richiesta</button>
    <dialog ref={dialog} className="status-modal request-delete-dialog" aria-label={`Elimina definitivamente la richiesta di ${name}`} onCancel={event=>{if(saving)event.preventDefault();}}>
      <form onSubmit={event=>{event.preventDefault();void confirm();}}>
        <p className="eyebrow">Eliminazione definitiva</p><h3>Eliminare questa richiesta?</h3>
        <p className="request-delete-identity"><strong>{name}</strong><span>{arrival} – {departure}</span></p>
        <p>La richiesta, il check-in, i preventivi, la cronologia e gli allegati associati saranno rimossi. Scomparirà anche dal calendario e dalle statistiche.</p>
        <p>L’operazione non può essere annullata dall’applicazione.</p>
        {error&&<p className="request-delete-error" role="alert">{error}</p>}
        <div className="status-modal-actions"><button ref={cancel} type="button" disabled={saving} onClick={()=>dialog.current?.close()}>Mantieni richiesta</button><button type="submit" className="button danger" disabled={saving||disabled}>{saving?"Eliminazione…":"Elimina definitivamente"}</button></div>
      </form>
    </dialog>
  </>;
}
