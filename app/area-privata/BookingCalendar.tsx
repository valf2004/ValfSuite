"use client";

import {useMemo,useState} from "react";
import type {ArchiveOutcome,AvailabilityEvent,AvailabilityRequest,Status} from "./RequestsDashboard";

const statusDefinitions:{id:Status;label:string;short:string}[]=[
  {id:"quote_requested",label:"Richiesta preventivo",short:"Richiesta"},
  {id:"quote_sent",label:"Preventivo inviato",short:"Preventivo"},
  {id:"accepted",label:"Prenotazione accettata",short:"Accettata"},
  {id:"checked_in",label:"Check-in eseguito",short:"Check-in"},
  {id:"police_registered",label:"Questura registrata",short:"Questura"},
  {id:"archived",label:"Archiviata",short:"Archivio"},
];
const weekdays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const confirmedStatuses:Status[]=["accepted","checked_in","police_registered"];

export default function BookingCalendar({initialRequests,events,today}:{initialRequests:AvailabilityRequest[];events:AvailabilityEvent[];today:string}){
  const [year,month]=today.split("-").map(Number);
  const [cursor,setCursor]=useState({year,month:month-1});
  const [enabled,setEnabled]=useState<Status[]>(statusDefinitions.map(item=>item.id));
  const [selection,setSelection]=useState<{date:string;items:AvailabilityRequest[]}|null>(null);
  const monthStart=useMemo(()=>new Date(Date.UTC(cursor.year,cursor.month,1)),[cursor]);
  const nextMonth=useMemo(()=>new Date(Date.UTC(cursor.year,cursor.month+1,1)),[cursor]);
  const gridDays=useMemo(()=>{
    const offset=(monthStart.getUTCDay()+6)%7;
    const start=addDays(monthStart,-offset);
    return Array.from({length:42},(_,index)=>addDays(start,index));
  },[monthStart]);
  const inMonth=useMemo(()=>initialRequests.filter(item=>item.arrivalDate<dateKey(nextMonth)&&item.departureDate>dateKey(monthStart)),[initialRequests,monthStart,nextMonth]);
  const filtered=useMemo(()=>inMonth.filter(item=>enabled.includes(item.status)),[inMonth,enabled]);
  const confirmed=inMonth.filter(item=>confirmedStatuses.includes(item.status)).length;
  const tentative=inMonth.filter(item=>!confirmedStatuses.includes(item.status)&&item.status!=="archived").length;
  const monthLabel=new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric",timeZone:"UTC"}).format(monthStart);
  function moveMonth(delta:number){const target=new Date(Date.UTC(cursor.year,cursor.month+delta,1));setCursor({year:target.getUTCFullYear(),month:target.getUTCMonth()});}
  function toggle(status:Status){setEnabled(current=>current.includes(status)?current.filter(item=>item!==status):[...current,status]);}
  function resetToday(){setCursor({year,month:month-1});}
  return <section className="calendar-panel">
    <div className="calendar-toolbar"><div><p className="eyebrow">Disponibilità e soggiorni</p><h1>Calendario prenotazioni</h1><p>Le richieste possono sovrapporsi; soltanto gli stati con colore pieno occupano effettivamente la struttura.</p></div><div className="calendar-month-controls"><button type="button" onClick={()=>moveMonth(-1)} aria-label="Mese precedente">‹</button><button type="button" className="calendar-today" onClick={resetToday}>Oggi</button><button type="button" onClick={()=>moveMonth(1)} aria-label="Mese successivo">›</button></div></div>
    <div className="calendar-summary"><h2>{capitalize(monthLabel)}</h2><div><span><strong>{confirmed}</strong> confermate</span><span><strong>{tentative}</strong> in valutazione</span><span><strong>{inMonth.length}</strong> totali</span></div></div>
    <div className="calendar-filters" aria-label="Filtra per stato">{statusDefinitions.map(definition=><button key={definition.id} type="button" aria-pressed={enabled.includes(definition.id)} onClick={()=>toggle(definition.id)}><i className={`calendar-status-dot status-${definition.id}`} aria-hidden="true"/>{definition.label}</button>)}</div>
    <div className="calendar-scroll"><div className="booking-calendar" role="grid" aria-label={`Calendario ${monthLabel}`}>
      {weekdays.map(day=><div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
      {gridDays.map(day=>{
        const key=dateKey(day);
        const items=filtered.filter(item=>item.arrivalDate<=key&&item.departureDate>key).sort(compareCalendarItems);
        const visible=items.slice(0,3);
        const hidden=items.length-visible.length;
        return <div className={`calendar-day${day.getUTCMonth()!==cursor.month?" outside":""}${key===today?" today":""}`} role="gridcell" key={key} aria-label={fullDate(key)}><span className="calendar-day-number">{day.getUTCDate()}</span><div className="calendar-day-items">{visible.map(item=><button type="button" key={item.id} className={`calendar-event ${statusClass(item)}${confirmedStatuses.includes(item.status)?" confirmed":" tentative"}${item.arrivalDate===key?" starts":""}`} onClick={()=>setSelection({date:key,items:[item]})} title={`${item.name} · ${statusLabel(item)}`}><strong>{item.name}</strong><small>{shortStatus(item)}</small></button>)}{hidden>0&&<button type="button" className="calendar-more" onClick={()=>setSelection({date:key,items})}>+ altre {hidden}</button>}</div></div>;
      })}
    </div></div>
    <p className="calendar-footnote"><span/> Colore pieno: soggiorno confermato. <span/> Bordo e fondo chiaro: richiesta ancora in valutazione. Il giorno del check-out non viene conteggiato come occupato.</p>
    {selection&&<CalendarModal selection={selection} events={events} close={()=>setSelection(null)} select={item=>setSelection(current=>current?{...current,items:[item]}:null)}/>}
  </section>;
}

function CalendarModal({selection,events,close,select}:{selection:{date:string;items:AvailabilityRequest[]};events:AvailabilityEvent[];close:()=>void;select:(item:AvailabilityRequest)=>void}){
  const single=selection.items.length===1?selection.items[0]:null;
  return <div className="status-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title"><button className="calendar-modal-close" type="button" onClick={close} aria-label="Chiudi">×</button>{single?<CalendarRequestDetail item={single} events={events.filter(event=>event.requestId===single.id)}/>:<><p className="eyebrow">{fullDate(selection.date)}</p><h2 id="calendar-modal-title">{selection.items.length} richieste nello stesso giorno</h2><div className="calendar-modal-list">{selection.items.map(item=><button key={item.id} type="button" onClick={()=>select(item)}><i className={`calendar-status-dot ${statusClass(item)}`}/><span><strong>{item.name}</strong><small>{statusLabel(item)} · {formatStay(item)}</small></span><b>›</b></button>)}</div></>}</section></div>;
}

function CalendarRequestDetail({item,events}:{item:AvailabilityRequest;events:AvailabilityEvent[]}){
  const latest=events.at(-1);
  return <><p className="eyebrow">{statusLabel(item)}</p><h2 id="calendar-modal-title">{item.name}</h2><div className="calendar-detail-status"><i className={`calendar-status-dot ${statusClass(item)}`}/>{confirmedStatuses.includes(item.status)?"Occupa la struttura":"Non blocca ancora la disponibilità"}</div><dl className="calendar-detail-grid"><div><dt>Soggiorno</dt><dd>{formatStay(item)}</dd></div><div><dt>Ospiti</dt><dd>{item.guestCount}</dd></div><div><dt>Preventivo</dt><dd>{item.quoteAmountCents==null?"Non registrato":formatCurrency(item.quoteAmountCents)}</dd></div><div><dt>Contatto</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a></dd></div></dl>{latest&&<div className="calendar-latest"><small>Ultimo aggiornamento · {formatDateTime(latest.createdAt)}</small><strong>{eventLabel(latest)}</strong>{latest.note&&<p>{latest.note}</p>}</div>}<div className="calendar-detail-actions"><a href={`mailto:${item.email}`}>Scrivi all’ospite</a><a className="button" href="/area-riservata">Apri nelle richieste</a></div></>;
}

function statusClass(item:AvailabilityRequest){if(item.status!=="archived")return `status-${item.status}`;return `status-archived-${item.archiveOutcome||"completed"}`;}
function statusLabel(item:AvailabilityRequest){if(item.status!=="archived")return statusDefinitions.find(definition=>definition.id===item.status)?.label||item.status;return ({completed:"Archiviata · completata",cancelled:"Archiviata · annullata",unavailable:"Archiviata · non disponibile"} as Record<ArchiveOutcome,string>)[item.archiveOutcome||"completed"];}
function shortStatus(item:AvailabilityRequest){if(item.status!=="archived")return statusDefinitions.find(definition=>definition.id===item.status)?.short||item.status;return item.archiveOutcome==="completed"?"Completata":item.archiveOutcome==="cancelled"?"Annullata":"Non disponibile";}
function compareCalendarItems(a:AvailabilityRequest,b:AvailabilityRequest){return statusRank(a)-statusRank(b)||a.arrivalDate.localeCompare(b.arrivalDate)||a.name.localeCompare(b.name,"it");}
function statusRank(item:AvailabilityRequest){return ({checked_in:0,police_registered:1,accepted:2,quote_sent:3,quote_requested:4,archived:5} as Record<Status,number>)[item.status];}
function addDays(date:Date,days:number){const value=new Date(date);value.setUTCDate(value.getUTCDate()+days);return value;}
function dateKey(date:Date){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;}
function fullDate(value:string){return new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function shortDate(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function formatStay(item:AvailabilityRequest){return `${shortDate(item.arrivalDate)} – ${shortDate(item.departureDate)}`;}
function formatCurrency(value:number){return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(value/100);}
function formatDateTime(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function eventLabel(event:AvailabilityEvent){if(event.eventType==="request_created")return "Richiesta ricevuta";if(event.eventType==="email_sent")return "Preventivo inviato";if(event.eventType==="payment_reported")return "Pagamento comunicato";if(event.eventType==="payment_confirmed")return "Pagamento verificato e conferma inviata";if(event.eventType==="balance_requested")return "Richiesta saldo inviata";if(event.eventType==="checkin_invited")return "Invito al check-in inviato";if(event.eventType==="checkin_submitted")return "Check-in online completato";return "Stato aggiornato";}
function capitalize(value:string){return value.charAt(0).toUpperCase()+value.slice(1);}
