"use client";

import { useMemo, useState } from "react";

export type AvailabilityRequest = {
  id: string; status: Status; archiveOutcome: ArchiveOutcome | null; name: string; email: string; arrivalDate: string;
  departureDate: string; guestCount: number; message: string; language: string;
  createdAt: string; updatedAt: string;
};
type Status = "quote_requested" | "quote_sent" | "accepted" | "checked_in" | "police_registered" | "archived";
type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
const tabs: { id: Status; label: string; empty: string }[] = [
  { id: "quote_requested", label: "Richieste preventivo", empty: "Nessuna richiesta da valutare." },
  { id: "quote_sent", label: "Preventivi inviati", empty: "Nessun preventivo inviato." },
  { id: "accepted", label: "Prenotazioni accettate", empty: "Nessuna prenotazione accettata." },
  { id: "checked_in", label: "Check-in eseguiti", empty: "Nessun check-in eseguito." },
  { id: "police_registered", label: "Questura registrata", empty: "Nessuna registrazione Questura completata." },
  { id: "archived", label: "Archiviate", empty: "L’archivio è vuoto." },
];

export default function RequestsDashboard({ initialRequests }: { initialRequests: AvailabilityRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [active, setActive] = useState<Status>("quote_requested");
  const [archiveFilter, setArchiveFilter] = useState<"all" | ArchiveOutcome>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => requests.filter(item => item.status === active && !(active === "archived" && archiveFilter !== "all" && item.archiveOutcome !== archiveFilter)), [requests, active, archiveFilter]);
  async function move(id: string, status: Status, archiveOutcome?: ArchiveOutcome) {
    setBusy(id); setNotice("");
    const response = await fetch("/api/gestione/richieste", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, archiveOutcome }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRequests(current => current.map(item => item.id === id ? data.request : item)); setNotice("Stato aggiornato."); }
    else setNotice(data.message || "Aggiornamento non riuscito.");
    setBusy(null);
  }
  return <>
    <section className="request-summary" aria-label="Riepilogo richieste">{tabs.slice(0,5).map(tab => <article key={tab.id}><small>{tab.label}</small><strong>{requests.filter(item => item.status === tab.id).length}</strong></article>)}</section>
    <section className="requests-panel"><div className="request-tabs" role="tablist" aria-label="Stato richiesta e prenotazione">{tabs.map(tab => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>{tab.label}<span>{requests.filter(item => item.status === tab.id).length}</span></button>)}</div>
      {active === "archived" && <div className="archive-filters">{([['all','Tutte'],['completed','Completate'],['cancelled','Annullate'],['unavailable','Non disponibili']] as const).map(([id,label]) => <button key={id} className={archiveFilter===id?"active":""} onClick={()=>setArchiveFilter(id)}>{label}</button>)}</div>}
      <p className="dashboard-notice" role="status">{notice}</p><div className="request-list" role="tabpanel">
        {!visible.length && <p className="request-empty">{tabs.find(tab => tab.id === active)?.empty}</p>}
        {visible.map(item => <article className="request-card" key={item.id}><div className="request-card-main"><p className="eyebrow">Ricevuta {formatDateTime(item.createdAt)}{item.archiveOutcome ? ` · ${outcomeLabel(item.archiveOutcome)}` : ""}</p><h2>{item.name}</h2><p><a href={`mailto:${item.email}`}>{item.email}</a> · {item.guestCount} {item.guestCount === 1 ? "ospite" : "ospiti"}</p></div>
          <dl><div><dt>Arrivo</dt><dd>{formatDate(item.arrivalDate)}</dd></div><div><dt>Partenza</dt><dd>{formatDate(item.departureDate)}</dd></div><div><dt>Notti</dt><dd>{nights(item.arrivalDate,item.departureDate)}</dd></div><div><dt>Lingua</dt><dd>{item.language.toUpperCase()}</dd></div></dl>
          {item.message && <p className="request-message">“{item.message}”</p>}<div className="request-actions"><a href={`mailto:${item.email}?subject=${encodeURIComponent("Richiesta disponibilità VALF Suite")}`}>Rispondi via email</a>{active==="quote_requested"&&<button disabled={busy===item.id} onClick={()=>move(item.id,"quote_sent")}>Preventivo inviato</button>}{active==="quote_sent"&&<button disabled={busy===item.id} onClick={()=>move(item.id,"accepted")}>Prenotazione accettata</button>}{active==="accepted"&&<button disabled={busy===item.id} onClick={()=>move(item.id,"checked_in")}>Check-in eseguito</button>}{active==="checked_in"&&<button disabled={busy===item.id} onClick={()=>move(item.id,"police_registered")}>Registrazione Questura eseguita</button>}{active!=="archived"&&<><button disabled={busy===item.id} onClick={()=>move(item.id,"archived","cancelled")}>Annulla</button><button disabled={busy===item.id} onClick={()=>move(item.id,"archived","unavailable")}>Non disponibile</button></>}</div></article>)}
      </div></section>
  </>;
}
function formatDate(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function formatDateTime(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function nights(arrival:string,departure:string){return Math.round((Date.parse(`${departure}T12:00:00Z`)-Date.parse(`${arrival}T12:00:00Z`))/86_400_000);}
function outcomeLabel(value:ArchiveOutcome){return {completed:"Completata",cancelled:"Annullata",unavailable:"Mancanza disponibilità"}[value];}
