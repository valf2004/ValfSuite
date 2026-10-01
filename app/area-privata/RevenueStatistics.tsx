"use client";

import {useMemo,useState} from "react";
import {buildRevenueStatistics,revenueSources,revenueYears,type RevenueSource,type RevenueStay} from "../lib/revenue-statistics.mjs";

const currency=(cents:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(cents/100);
const shortDate=(value:string)=>new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));
type Granularity="week"|"month"|"year";
function periodLabel(row:{key:string;startDate:string;endDate:string},granularity:Granularity){
  if(granularity==="year")return row.key;
  if(granularity==="month")return new Intl.DateTimeFormat("it-IT",{month:"long",timeZone:"UTC"}).format(new Date(`${row.startDate}T00:00:00Z`));
  return `${shortDate(row.startDate)} – ${shortDate(row.endDate)}`;
}

export default function RevenueStatistics({stays,today}:{stays:RevenueStay[];today:string}){
  const [granularity,setGranularity]=useState<Granularity>("month");
  const [year,setYear]=useState(Number(today.slice(0,4)));
  const [source,setSource]=useState<RevenueSource|"all">("all");
  const [scope,setScope]=useState<"confirmed"|"completed">("confirmed");
  const years=useMemo(()=>revenueYears(stays,Number(today.slice(0,4))),[stays,today]);
  const stats=useMemo(()=>buildRevenueStatistics(stays,{granularity,year,source,scope,today}),[stays,granularity,year,source,scope,today]);
  const visibleSources=revenueSources.filter(item=>source==="all"||item.id===source);
  const maximum=Math.max(1,...stats.rows.map(row=>row.totalCents));
  const sourceMaximum=Math.max(1,...visibleSources.map(item=>stats.sourceTotals[item.id]));
  const context=granularity==="year"?"Tutti gli anni":String(year);
  return <section className="revenue-panel">
    <header className="revenue-heading"><div><p className="eyebrow">Gestione soggiorni</p><h1>Statistiche ricavi</h1><p>Prezzi totali concordati, ripartiti sulle notti del soggiorno.</p></div><span>{context}</span></header>
    <div className="revenue-controls">
      <div className="revenue-period-buttons" role="group" aria-label="Raggruppa i ricavi">{([['week','Settimana'],['month','Mese'],['year','Anno']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={granularity===value} onClick={()=>setGranularity(value)}>{label}</button>)}</div>
      {granularity!=="year"&&<label>Anno<select value={year} onChange={event=>setYear(Number(event.target.value))}>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      <label>Provenienza<select value={source} onChange={event=>setSource(event.target.value as RevenueSource|"all")}><option value="all">Tutte le provenienze</option>{revenueSources.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Soggiorni<select value={scope} onChange={event=>setScope(event.target.value as "confirmed"|"completed")}><option value="confirmed">Confermati e completati</option><option value="completed">Solo soggiorni terminati</option></select></label>
    </div>
    <div className="revenue-totals" aria-live="polite"><article><span>Ricavi concordati · {context}</span><strong>{currency(stats.totalCents)}</strong></article><article><span>Soggiorni con importo</span><strong>{stats.stayCount}</strong></article><article className={stats.missingCount?"missing":""}><span>Soggiorni senza importo</span><strong>{stats.missingCount}</strong></article></div>
    {stats.missingCount>0&&<p className="revenue-warning" role="status">{stats.missingCount} {stats.missingCount===1?"soggiorno non è incluso":"soggiorni non sono inclusi"} nei ricavi perché manca il prezzo concordato. Puoi inserirlo dalle <a href="/area-riservata">schede delle richieste</a>.</p>}
    {!stats.stayCount&&!stats.missingCount&&<p className="revenue-empty">Nessun soggiorno corrisponde ai filtri selezionati.</p>}
    <section className="revenue-chart-section" aria-labelledby="revenue-chart-title"><h2 id="revenue-chart-title">Andamento dei ricavi</h2>
      <div className="revenue-chart-scale"><span>{currency(maximum===1&&stats.totalCents===0?0:maximum)}</span><span>0 €</span></div>
      <div className="revenue-chart-scroll"><div className={`revenue-chart ${granularity}`} style={{gridTemplateColumns:`repeat(${stats.rows.length},minmax(${granularity==="week"?"24":"48"}px,1fr))`}}>{stats.rows.map((row,index)=>{
        const label=periodLabel(row,granularity);
        const tooltip=[label,currency(row.totalCents),...visibleSources.filter(item=>row.bySource[item.id]>0).map(item=>`${item.label}: ${currency(row.bySource[item.id])}`)].join("\n");
        return <div className="revenue-chart-column" key={row.key}><div className="revenue-chart-track" role="img" aria-label={`${label}: ${currency(row.totalCents)}`} title={tooltip}><div className="revenue-chart-bar" style={{height:`${row.totalCents/maximum*100}%`}}>{visibleSources.filter(item=>row.bySource[item.id]>0).map(item=><span key={item.id} style={{background:item.color,height:`${row.bySource[item.id]/row.totalCents*100}%`}}/>)}</div></div><span className="revenue-chart-label">{granularity!=="week"?granularity==="month"?label.slice(0,3):label:index%4===0||index===stats.rows.length-1?shortDate(row.startDate):""}</span></div>;
      })}</div></div>
      <ul className="revenue-legend">{visibleSources.map(item=><li key={item.id}><span style={{background:item.color}}/>{item.label}</li>)}</ul>
    </section>
    <section className="revenue-by-source" aria-labelledby="revenue-source-title"><h2 id="revenue-source-title">Ricavi per provenienza</h2>{visibleSources.map(item=><div className="revenue-source-row" key={item.id}><span>{item.label}</span><div className="revenue-source-track" aria-hidden="true"><span style={{background:item.color,width:`${stats.sourceTotals[item.id]/sourceMaximum*100}%`}}/></div><strong>{currency(stats.sourceTotals[item.id])}</strong><small>{stats.totalCents?new Intl.NumberFormat("it-IT",{maximumFractionDigits:1}).format(stats.sourceTotals[item.id]/stats.totalCents*100):"0"}%</small></div>)}</section>
    <section className="revenue-details" aria-labelledby="revenue-details-title"><h2 id="revenue-details-title">Dettaglio per {granularity==="week"?"settimana":granularity==="month"?"mese":"anno"}</h2><div className="revenue-table-scroll"><table className="revenue-table"><caption className="sr-only">Ricavi concordati per periodo e provenienza · {context}</caption><thead><tr><th scope="col">Periodo</th>{visibleSources.map(item=><th scope="col" key={item.id}>{item.label}</th>)}<th scope="col">Totale</th></tr></thead><tbody>{stats.rows.map(row=><tr key={row.key}><th scope="row">{periodLabel(row,granularity)}</th>{visibleSources.map(item=><td key={item.id}>{row.bySource[item.id]?currency(row.bySource[item.id]):"—"}</td>)}<td><strong>{currency(row.totalCents)}</strong></td></tr>)}</tbody><tfoot><tr><th scope="row">Totale</th>{visibleSources.map(item=><td key={item.id}>{currency(stats.sourceTotals[item.id])}</td>)}<td>{currency(stats.totalCents)}</td></tr></tfoot></table></div></section>
    <p className="revenue-method">Sono inclusi i soggiorni accettati, con check-in o registrazione Questura eseguiti e le pratiche archiviate come completate. Le richieste di preventivo e le pratiche annullate o non disponibili sono escluse. “Solo soggiorni terminati” include quelli con partenza entro oggi. La notte del check-out non è conteggiata. Nella vista settimanale, le settimane iniziano il lunedì e sono limitate all’anno selezionato. Gli importi rappresentano i prezzi concordati, non i pagamenti incassati.</p>
  </section>;
}
