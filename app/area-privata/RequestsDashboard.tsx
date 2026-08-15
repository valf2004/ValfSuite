"use client";

import { useMemo, useState } from "react";

export type AvailabilityRequest = {
  id: string; status: Status; archiveOutcome: ArchiveOutcome | null; name: string; email: string; arrivalDate: string;
  departureDate: string; guestCount: number; message: string; language: string;
  quoteAmountCents: number | null; quoteSubject: string | null; quoteBody: string | null; quoteSentAt: string | null;
  createdAt: string; updatedAt: string;
};
export type AvailabilityEvent = { id:string; requestId:string; eventType:"request_created"|"email_sent"|"payment_reported"|"status_changed"; fromStatus:string|null; toStatus:string|null; actorEmail:string|null; note:string|null; subject:string|null; body:string|null; amountCents:number|null; attachmentId:string|null; attachmentName:string|null; createdAt:string };
type Status = "quote_requested" | "quote_sent" | "payment_reported" | "accepted" | "checked_in" | "police_registered" | "archived";
type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
const tabs: { id: Status; label: string; empty: string }[] = [
  { id: "quote_requested", label: "Richieste preventivo", empty: "Nessuna richiesta da valutare." },
  { id: "quote_sent", label: "Preventivi inviati", empty: "Nessun preventivo inviato." },
  { id: "payment_reported", label: "Pagamenti da verificare", empty: "Nessun pagamento da verificare." },
  { id: "accepted", label: "Prenotazioni accettate", empty: "Nessuna prenotazione accettata." },
  { id: "checked_in", label: "Check-in eseguiti", empty: "Nessun check-in eseguito." },
  { id: "police_registered", label: "Questura registrata", empty: "Nessuna registrazione Questura completata." },
  { id: "archived", label: "Archiviate", empty: "L’archivio è vuoto." },
];

export default function RequestsDashboard({ initialRequests, initialEvents }: { initialRequests: AvailabilityRequest[]; initialEvents:AvailabilityEvent[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [events, setEvents] = useState(initialEvents);
  const [active, setActive] = useState<Status>("quote_requested");
  const [archiveFilter, setArchiveFilter] = useState<"all" | ArchiveOutcome>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [quoteDraft, setQuoteDraft] = useState({ subject:"", body:"", price:"" });
  const visible = useMemo(() => requests.filter(item => item.status === active && !(active === "archived" && archiveFilter !== "all" && item.archiveOutcome !== archiveFilter)).sort(compareStayPeriod), [requests, active, archiveFilter]);
  async function move(id: string, status: Status, archiveOutcome?: ArchiveOutcome, note?:string) {
    setBusy(id); setNotice("");
    const response = await fetch("/api/gestione/richieste", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, archiveOutcome, note }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRequests(current => current.map(item => item.id === id ? data.request : item)); if(data.event)setEvents(current=>[...current,data.event]); setNotice("Stato aggiornato."); }
    else setNotice(data.message || "Aggiornamento non riuscito.");
    setBusy(null);
  }
  function openQuote(item: AvailabilityRequest) {
    const template = quoteTemplate(item);
    setQuoteDraft({ subject:template.subject, body:template.body, price:item.quoteAmountCents == null ? "" : (item.quoteAmountCents / 100).toFixed(2).replace(".", ",") });
    setQuoteFor(item.id); setNotice("");
  }
  async function sendQuote(item: AvailabilityRequest) {
    setBusy(item.id); setNotice("");
    const response = await fetch("/api/gestione/preventivo", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:item.id, ...quoteDraft }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRequests(current => current.map(row => row.id === item.id ? data.request : row)); if(data.event)setEvents(current=>[...current,data.event]); setQuoteFor(null); setNotice(`Preventivo inviato a ${item.email}.`); }
    else setNotice(data.message || "Invio del preventivo non riuscito.");
    setBusy(null);
  }
  return <>
    <section className="requests-panel"><div className="request-tabs" role="tablist" aria-label="Stato richiesta e prenotazione">{tabs.map(tab => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>{tab.label}<span>{requests.filter(item => item.status === tab.id).length}</span></button>)}</div>
      {active === "archived" && <div className="archive-filters">{([['all','Tutte'],['completed','Completate'],['cancelled','Annullate'],['unavailable','Non disponibili']] as const).map(([id,label]) => <button key={id} className={archiveFilter===id?"active":""} onClick={()=>setArchiveFilter(id)}>{label}</button>)}</div>}
      <p className="dashboard-notice" role="status">{notice}</p><div className="request-list" role="tabpanel">
        {!visible.length && <p className="request-empty">{tabs.find(tab => tab.id === active)?.empty}</p>}
        {visible.map(item => <RequestCard key={item.id} item={item} events={events.filter(event=>event.requestId===item.id)} active={active} busy={busy} quoteOpen={quoteFor===item.id} quoteDraft={quoteDraft} setQuoteDraft={setQuoteDraft} openQuote={openQuote} closeQuote={()=>setQuoteFor(null)} sendQuote={sendQuote} move={move}/>) }
      </div></section>
  </>;
}

function RequestCard({item,events,active,busy,quoteOpen,quoteDraft,setQuoteDraft,openQuote,closeQuote,sendQuote,move}:{
  item:AvailabilityRequest; events:AvailabilityEvent[]; active:Status; busy:string|null; quoteOpen:boolean; quoteDraft:{subject:string;body:string;price:string};
  setQuoteDraft:(value:{subject:string;body:string;price:string})=>void; openQuote:(item:AvailabilityRequest)=>void; closeQuote:()=>void;
  sendQuote:(item:AvailabilityRequest)=>void; move:(id:string,status:Status,outcome?:ArchiveOutcome,note?:string)=>void;
}) {
  const [expanded,setExpanded]=useState(false);
  const [operatorNote,setOperatorNote]=useState("");
  const [pendingStatus,setPendingStatus]=useState<string|null>(null);
  const priority=getPriority(item);
  const statusValue=item.status === "archived" ? `archived:${item.archiveOutcome || "completed"}` : item.status;
  function changeStatus() { if(!pendingStatus)return; const [status,outcome]=pendingStatus.split(":") as [Status,ArchiveOutcome?]; move(item.id,status,outcome,operatorNote); setOperatorNote(""); setPendingStatus(null); }
  return <article className={`request-card priority-${priority.level}`}>
    <div className="request-card-top"><button className="request-expand" type="button" aria-expanded={expanded} aria-label={expanded?"Chiudi cronologia":"Apri cronologia"} onClick={()=>setExpanded(value=>!value)}><span aria-hidden="true">›</span></button><div className="request-card-main"><p className="eyebrow">{statusLabel(item.status)}{item.archiveOutcome ? ` · ${outcomeLabel(item.archiveOutcome)}` : ""}</p><h2>{item.name}</h2><p>{formatDate(item.arrivalDate)} – {formatDate(item.departureDate)} · {item.guestCount} {item.guestCount === 1 ? "ospite" : "ospiti"} · <strong>{item.quoteAmountCents == null ? "Preventivo non registrato" : formatCurrency(item.quoteAmountCents)}</strong></p></div>{active !== "archived" && <div className={`priority-badge ${priority.level}`}><small>{priority.action}</small><strong>{priority.label}</strong></div>}</div>
    <div className="request-actions"><button className="primary-action" disabled={busy===item.id} onClick={()=>openQuote(item)}>{item.status === "quote_sent" || item.status === "payment_reported" ? "Invia nuovamente" : "Prepara preventivo"}</button><a href={`mailto:${item.email}`}>Email libera</a><label className="status-control"><span>Stato</span><select value={statusValue} disabled={busy===item.id} onChange={event=>{if(event.target.value!==statusValue)setPendingStatus(event.target.value);}}><option value="quote_requested">Richiesta preventivo</option><option value="quote_sent">Preventivo inviato</option><option value="payment_reported">Pagamento comunicato</option><option value="accepted">Accettata</option><option value="checked_in">Check-in eseguito</option><option value="police_registered">Questura registrata</option><option value="archived:completed">Archiviata · completata</option><option value="archived:cancelled">Archiviata · annullata</option><option value="archived:unavailable">Archiviata · non disponibile</option></select></label></div>
    {expanded && <div className="request-details"><section className="request-timeline"><h3>Cronologia</h3>{!events.length?<p className="timeline-empty">Cronologia disponibile dai prossimi aggiornamenti.</p>:<ol>{[...events].reverse().map(event=><li key={event.id}><span className={`timeline-dot ${event.eventType}`}/><div><p><strong>{eventTitle(event)}</strong><time>{formatDateTime(event.createdAt)}</time></p>{event.actorEmail&&<small>Operatore: {event.actorEmail}</small>}{event.note&&<p className="timeline-note">{event.note}</p>}{event.subject&&<details className="email-history"><summary>{event.subject}</summary><pre>{event.body}</pre></details>}{event.eventType==="payment_reported"&&event.body&&<p className="timeline-note">Messaggio: {event.body}</p>}{event.amountCents!=null&&<b>{formatCurrency(event.amountCents)}</b>}{event.attachmentId&&<a className="receipt-download" href={`/api/gestione/ricevute/${event.attachmentId}`}>Scarica ricevuta · {event.attachmentName||"allegato"}</a>}</div></li>)}</ol>}</section></div>}
    {quoteOpen && <form className="quote-form" onSubmit={event=>{event.preventDefault();sendQuote(item);}}><div className="quote-form-heading"><div><p className="eyebrow">Preventivo in {languageLabel(item.language)}</p><h3>Invia a {item.name}</h3></div><button type="button" className="quote-close" onClick={closeQuote} aria-label="Chiudi">×</button></div><div className="quote-grid"><label>Importo totale (€)<input type="text" inputMode="decimal" placeholder="es. 480,00" required value={quoteDraft.price} onChange={e=>setQuoteDraft({...quoteDraft,price:e.target.value})}/></label><label>Destinatario<input type="email" value={item.email} readOnly/></label><label className="field-wide">Oggetto<input required maxLength={180} value={quoteDraft.subject} onChange={e=>setQuoteDraft({...quoteDraft,subject:e.target.value})}/></label><label className="field-wide">Testo<textarea required rows={14} maxLength={6000} value={quoteDraft.body} onChange={e=>setQuoteDraft({...quoteDraft,body:e.target.value})}/><small><code>{`{PREZZO}`}</code>, <code>{`{ACCONTO}`}</code>, <code>{`{SALDO}`}</code> e <code>{`{DATA_SALDO}`}</code> saranno calcolati automaticamente.</small></label></div><div className="quote-actions"><button type="button" onClick={closeQuote}>Annulla</button><button className="button" disabled={busy===item.id}>{busy===item.id ? "Invio…" : "Invia preventivo"}</button></div></form>}
    {pendingStatus&&<div className="status-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingStatus(null);}}><section className="status-modal" role="dialog" aria-modal="true" aria-labelledby={`status-title-${item.id}`}><p className="eyebrow">Cambio di stato</p><h3 id={`status-title-${item.id}`}>{statusLabel(item.status)} → {statusLabel(pendingStatus.split(":")[0])}</h3><p>Inserisci una nota, oppure incolla il testo completo di un’email inviata esternamente al sistema.</p><label>Nota o comunicazione<textarea autoFocus rows={11} maxLength={10000} value={operatorNote} onChange={event=>setOperatorNote(event.target.value)} placeholder="Facoltativo: annotazione, risposta del cliente o contenuto dell’email…"/></label><div className="status-modal-actions"><button type="button" onClick={()=>{setPendingStatus(null);setOperatorNote("");}}>Annulla</button><button type="button" className="button" disabled={busy===item.id} onClick={changeStatus}>{busy===item.id?"Registrazione…":"Conferma cambio stato"}</button></div></section></div>}
  </article>;
}

function quoteTemplate(item:AvailabilityRequest) {
  const locale=({it:"it-IT",en:"en-GB",fr:"fr-FR",es:"es-ES",de:"de-DE"} as Record<string,string>)[item.language] || "it-IT";
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
  const data={name:item.name,arrival:date(item.arrivalDate),departure:date(item.departureDate),guests:item.guestCount,nights:nights(item.arrivalDate,item.departureDate)};
  const templates:Record<string,{subject:string;body:string}>={
    it:{subject:"La tua proposta di soggiorno a VALF Suite",body:`Gentile ${data.name},\n\nsiamo lieti di confermare la disponibilità di VALF Suite dal ${data.arrival} al ${data.departure}, per ${data.guests} ospiti (${data.nights} notti).\n\nIl prezzo complessivo del soggiorno è di {PREZZO}.\n\nPer confermare la prenotazione è richiesto un acconto del 30%, pari a {ACCONTO}. Il saldo del restante 70%, pari a {SALDO}, dovrà essere versato entro il {DATA_SALDO}, ossia 7 giorni prima dell'arrivo. Per prenotazioni confermate a meno di 7 giorni dall'arrivo è richiesto il pagamento dell'intero importo.\n\nPuoi effettuare il pagamento tramite:\n- bonifico bancario, IBAN: IT39E0301503200000003543654\n- PayPal: vorlandi@libero.it\n\nLa prenotazione si considera confermata dopo la ricezione dell'acconto e della nostra conferma scritta. La proposta resta soggetta a disponibilità fino a quel momento. In caso di cancellazione è previsto il rimborso completo fino a 7 giorni prima dell'arrivo; oltre tale termine, gli importi versati non sono rimborsabili.\n\nPer accettare la proposta, rispondi a questa email indicando il metodo di pagamento scelto.\n\nRestiamo a disposizione per qualsiasi informazione.\n\nUn cordiale saluto,\nAngela · VALF Suite`},
    en:{subject:"Your stay proposal at VALF Suite",body:`Dear ${data.name},\n\nwe are pleased to confirm availability at VALF Suite from ${data.arrival} to ${data.departure}, for ${data.guests} guests (${data.nights} nights).\n\nThe total price for the stay is {PREZZO}.\n\nTo confirm the booking, an advance payment of 30%, equal to {ACCONTO}, is required. The remaining 70% balance, equal to {SALDO}, must be paid by {DATA_SALDO}, 7 days before arrival. For bookings confirmed less than 7 days before arrival, full payment is required.\n\nYou can pay by:\n- bank transfer, IBAN: IT39E0301503200000003543654\n- PayPal: vorlandi@libero.it\n\nThe booking is considered confirmed once we have received the advance payment and sent our written confirmation. Until then, this proposal remains subject to availability. Cancellations receive a full refund up to 7 days before arrival; after that date, amounts paid are non-refundable.\n\nTo accept this proposal, reply to this email and indicate your preferred payment method.\n\nPlease feel free to contact us for any further information.\n\nKind regards,\nAngela · VALF Suite`},
    fr:{subject:"Votre proposition de séjour à VALF Suite",body:`Bonjour ${data.name},\n\nnous avons le plaisir de confirmer la disponibilité de VALF Suite du ${data.arrival} au ${data.departure}, pour ${data.guests} personnes (${data.nights} nuits).\n\nLe prix total du séjour est de {PREZZO}.\n\nPour confirmer la réservation, un acompte de 30 %, soit {ACCONTO}, est demandé. Le solde de 70 %, soit {SALDO}, devra être réglé au plus tard le {DATA_SALDO}, 7 jours avant l'arrivée. Pour toute réservation confirmée moins de 7 jours avant l'arrivée, le paiement intégral est demandé.\n\nVous pouvez payer par :\n- virement bancaire, IBAN : IT39E0301503200000003543654\n- PayPal : vorlandi@libero.it\n\nLa réservation sera considérée comme confirmée après réception de l'acompte et envoi de notre confirmation écrite. Jusque-là, cette proposition reste soumise à disponibilité. En cas d'annulation, un remboursement intégral est prévu jusqu'à 7 jours avant l'arrivée ; au-delà, les sommes versées ne sont pas remboursables.\n\nPour accepter cette proposition, répondez à cet e-mail en indiquant le mode de paiement choisi.\n\nNous restons à votre disposition.\n\nCordialement,\nAngela · VALF Suite`},
    es:{subject:"Tu propuesta de estancia en VALF Suite",body:`Hola ${data.name},\n\nnos complace confirmar la disponibilidad de VALF Suite del ${data.arrival} al ${data.departure}, para ${data.guests} huéspedes (${data.nights} noches).\n\nEl precio total de la estancia es de {PREZZO}.\n\nPara confirmar la reserva se requiere un anticipo del 30 %, equivalente a {ACCONTO}. El 70 % restante, equivalente a {SALDO}, deberá abonarse antes del {DATA_SALDO}, 7 días antes de la llegada. Para reservas confirmadas con menos de 7 días de antelación, se requiere el pago completo.\n\nPuedes pagar mediante:\n- transferencia bancaria, IBAN: IT39E0301503200000003543654\n- PayPal: vorlandi@libero.it\n\nLa reserva se considerará confirmada cuando recibamos el anticipo y enviemos nuestra confirmación por escrito. Hasta entonces, la propuesta estará sujeta a disponibilidad. En caso de cancelación, se efectuará un reembolso completo hasta 7 días antes de la llegada; después de esa fecha, los importes abonados no serán reembolsables.\n\nPara aceptar la propuesta, responde a este correo indicando el método de pago elegido.\n\nQuedamos a tu disposición.\n\nUn cordial saludo,\nAngela · VALF Suite`},
    de:{subject:"Ihr Aufenthaltsangebot für VALF Suite",body:`Guten Tag ${data.name},\n\ngerne bestätigen wir die Verfügbarkeit der VALF Suite vom ${data.arrival} bis zum ${data.departure}, für ${data.guests} Gäste (${data.nights} Nächte).\n\nDer Gesamtpreis für den Aufenthalt beträgt {PREZZO}.\n\nZur Bestätigung der Buchung ist eine Anzahlung von 30 % in Höhe von {ACCONTO} erforderlich. Der Restbetrag von 70 % in Höhe von {SALDO} ist bis zum {DATA_SALDO}, also 7 Tage vor der Anreise, zu zahlen. Bei Buchungen, die weniger als 7 Tage vor der Anreise bestätigt werden, ist der Gesamtbetrag zu zahlen.\n\nDie Zahlung ist möglich per:\n- Banküberweisung, IBAN: IT39E0301503200000003543654\n- PayPal: vorlandi@libero.it\n\nDie Buchung gilt nach Eingang der Anzahlung und unserer schriftlichen Bestätigung als bestätigt. Bis dahin bleibt dieses Angebot vorbehaltlich der Verfügbarkeit. Bei einer Stornierung bis 7 Tage vor der Anreise erfolgt eine vollständige Erstattung; danach sind bereits gezahlte Beträge nicht erstattungsfähig.\n\nZur Annahme dieses Angebots antworten Sie bitte auf diese E-Mail und nennen Sie die gewünschte Zahlungsart.\n\nFür Rückfragen stehen wir gerne zur Verfügung.\n\nMit freundlichen Grüßen,\nAngela · VALF Suite`},
  };
  const template=templates[item.language]||templates.it;
  const paymentInstructions:Record<string,[string,string]>={
    it:["Per accettare la proposta, rispondi a questa email indicando il metodo di pagamento scelto.","Dopo aver effettuato l'acconto, apri il seguente modulo per comunicarci il pagamento e, se vuoi, allegare la ricevuta:\n{LINK_PAGAMENTO}\n\nLa prenotazione sarà confermata dopo la verifica dell'accredito e l'invio della nostra conferma scritta. Se non riesci a utilizzare il modulo, puoi rispondere direttamente a questa email allegando la ricevuta."],
    en:["To accept this proposal, reply to this email and indicate your preferred payment method.","After making the advance payment, open the following form to notify us and, if you wish, attach the receipt:\n{LINK_PAGAMENTO}\n\nThe booking will be confirmed after we verify the payment and send our written confirmation. If you cannot use the form, you may reply directly to this email and attach the receipt."],
    fr:["Pour accepter cette proposition, répondez à cet e-mail en indiquant le mode de paiement choisi.","Après avoir versé l'acompte, ouvrez le formulaire suivant pour nous signaler le paiement et, si vous le souhaitez, joindre le reçu :\n{LINK_PAGAMENTO}\n\nLa réservation sera confirmée après vérification du paiement et envoi de notre confirmation écrite. Si vous ne pouvez pas utiliser le formulaire, vous pouvez répondre directement à cet e-mail en joignant le reçu."],
    es:["Para aceptar la propuesta, responde a este correo indicando el método de pago elegido.","Después de realizar el anticipo, abre el siguiente formulario para comunicarnos el pago y, si lo deseas, adjuntar el recibo:\n{LINK_PAGAMENTO}\n\nLa reserva se confirmará después de verificar el pago y enviar nuestra confirmación por escrito. Si no puedes utilizar el formulario, puedes responder directamente a este correo adjuntando el recibo."],
    de:["Zur Annahme dieses Angebots antworten Sie bitte auf diese E-Mail und nennen Sie die gewünschte Zahlungsart.","Öffnen Sie nach der Anzahlung das folgende Formular, um uns die Zahlung mitzuteilen und auf Wunsch den Beleg hochzuladen:\n{LINK_PAGAMENTO}\n\nDie Buchung wird nach Prüfung des Zahlungseingangs und unserer schriftlichen Bestätigung verbindlich. Falls Sie das Formular nicht verwenden können, können Sie direkt auf diese E-Mail antworten und den Beleg anhängen."],
  };
  const [oldInstruction,newInstruction]=paymentInstructions[item.language]||paymentInstructions.it;
  return {...template,body:template.body.replace(oldInstruction,newInstruction)};
}
function languageLabel(value:string){return ({it:"italiano",en:"inglese",fr:"francese",es:"spagnolo",de:"tedesco"} as Record<string,string>)[value] || value.toUpperCase();}
function formatDate(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function formatDateTime(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function formatCurrency(value:number){return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(value/100);}
function nights(arrival:string,departure:string){return Math.round((Date.parse(`${departure}T12:00:00Z`)-Date.parse(`${arrival}T12:00:00Z`))/86_400_000);}
function outcomeLabel(value:ArchiveOutcome){return {completed:"Completata",cancelled:"Annullata",unavailable:"Mancanza disponibilità"}[value];}
function compareStayPeriod(a:AvailabilityRequest,b:AvailabilityRequest){return a.arrivalDate.localeCompare(b.arrivalDate)||a.departureDate.localeCompare(b.departureDate)||a.name.localeCompare(b.name,"it");}
function statusLabel(value:string){return ({quote_requested:"Richiesta preventivo",quote_sent:"Preventivo inviato",payment_reported:"Pagamento comunicato",accepted:"Accettata",checked_in:"Check-in eseguito",police_registered:"Questura registrata",archived:"Archiviata"} as Record<string,string>)[value]||value;}
function eventTitle(event:AvailabilityEvent){if(event.eventType==="request_created")return "Richiesta ricevuta";if(event.eventType==="email_sent")return event.amountCents!=null?"Preventivo inviato":"Email inviata";if(event.eventType==="payment_reported")return "Pagamento comunicato dall’ospite";return `${event.fromStatus?statusLabel(event.fromStatus)+" → ":""}${statusLabel(event.toStatus||"")}`;}
function priorityDate(item: AvailabilityRequest) {
  if (item.status === "quote_requested") return new Date(item.createdAt);
  if (item.status === "police_registered") return new Date(`${item.departureDate}T12:00:00`);
  if (item.status === "archived") return new Date(item.updatedAt);
  return new Date(`${item.arrivalDate}T12:00:00`);
}
function getPriority(item: AvailabilityRequest) {
  const action = ({ quote_requested:"Preparare il preventivo", quote_sent:"Attendere il pagamento", payment_reported:"Verificare l’accredito", accepted:"Completare il check-in", checked_in:"Registrare in Questura", police_registered:"Chiudere il soggiorno", archived:"Archiviata" } as const)[item.status];
  if (item.status === "quote_requested") {
    const hours = Math.max(0, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 3_600_000));
    if (hours >= 24) return { level:"overdue", label:`In attesa da ${Math.floor(hours/24)} g`, action };
    if (hours >= 4) return { level:"today", label:`In attesa da ${hours} h`, action };
    return { level:"soon", label:"Nuova richiesta", action };
  }
  const target = priorityDate(item); const today = new Date(); today.setHours(0,0,0,0); target.setHours(0,0,0,0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { level:"overdue", label:`Scaduta da ${Math.abs(days)} g`, action };
  if (days === 0) return { level:"today", label:"Da fare oggi", action };
  if (days <= 3) return { level:"soon", label:`Tra ${days} g`, action };
  return { level:"planned", label:formatDate(item.status === "police_registered" ? item.departureDate : item.arrivalDate), action };
}
