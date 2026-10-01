const dayMs=86400000;
export const revenueSources=[
  {id:"website",label:"Sito VALF Suite",color:"#176c62"},
  {id:"phone",label:"Telefono",color:"#466f9f"},
  {id:"booking",label:"Booking.com",color:"#244aa0"},
  {id:"airbnb",label:"Airbnb",color:"#bd5463"},
  {id:"walk_in",label:"Contatto diretto",color:"#987a3a"},
  {id:"other",label:"Altro",color:"#805c9d"},
  {id:"unknown",label:"Non indicata",color:"#787d83"},
];

function ordinal(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const time=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time/dayMs:null;
}
const date=day=>new Date(day*dayMs).toISOString().slice(0,10);
const isConfirmed=stay=>["accepted","checked_in","police_registered"].includes(stay.status)||(stay.status==="archived"&&stay.archiveOutcome==="completed");

export function prepareRevenueStays(requests){
  const byId=new Map(requests.map(item=>[item.id,item]));
  function origin(item){
    const visited=new Set();
    while(item.sourceRequestId){
      if(visited.has(item.id))return "unknown";
      visited.add(item.id);
      const parent=byId.get(item.sourceRequestId);
      if(!parent)return "unknown";
      item=parent;
    }
    if(item.relationReason!=="new_stay")return "website";
    const label=(item.message||"").match(/^Inserimento diretto · Provenienza: ([^\r\n]+)/)?.[1]?.trim();
    return revenueSources.find(source=>source.label===label)?.id||"unknown";
  }
  return requests.map(item=>({id:item.id,status:item.status,archiveOutcome:item.archiveOutcome,arrivalDate:item.arrivalDate,departureDate:item.departureDate,amountCents:item.quoteAmountCents,source:origin(item)}));
}

export function revenueYears(stays,currentYear){
  const years=new Set([currentYear]);
  for(const stay of stays){
    if(!isConfirmed(stay))continue;
    const start=ordinal(stay.arrivalDate),end=ordinal(stay.departureDate);
    if(start==null||end==null||end<=start)continue;
    for(let year=Number(date(start).slice(0,4));year<=Number(date(end-1).slice(0,4));year++)years.add(year);
  }
  return [...years].sort((a,b)=>b-a);
}

function periods(granularity,year,years){
  if(granularity==="year")return [...years].sort((a,b)=>a-b).map(value=>({key:String(value),start:ordinal(`${value}-01-01`),end:ordinal(`${value+1}-01-01`)}));
  if(granularity==="month")return Array.from({length:12},(_,index)=>({key:`${year}-${String(index+1).padStart(2,"0")}`,start:ordinal(`${year}-${String(index+1).padStart(2,"0")}-01`),end:ordinal(index===11?`${year+1}-01-01`:`${year}-${String(index+2).padStart(2,"0")}-01`)}));
  const first=ordinal(`${year}-01-01`),end=ordinal(`${year+1}-01-01`);
  const weekday=new Date(first*dayMs).getUTCDay();
  const rows=[];
  for(let start=first-((weekday+6)%7);start<end;start+=7)rows.push({key:date(start),start:Math.max(first,start),end:Math.min(end,start+7)});
  return rows;
}

export function buildRevenueStatistics(stays,{granularity="month",year,source="all",scope="confirmed",today}){
  const years=revenueYears(stays,Number(today.slice(0,4)));
  const rows=periods(granularity,year,years).map(period=>({...period,startDate:date(period.start),endDate:date(period.end-1),totalCents:0,bySource:Object.fromEntries(revenueSources.map(item=>[item.id,0])),stayIds:new Set(),missingIds:new Set()}));
  const counted=new Set(),missing=new Set();
  const todayOrdinal=ordinal(today);
  for(const stay of stays){
    if(!isConfirmed(stay)||(source!=="all"&&stay.source!==source))continue;
    const start=ordinal(stay.arrivalDate),end=ordinal(stay.departureDate);
    if(start==null||end==null||end<=start||(scope==="completed"&&end>todayOrdinal))continue;
    const valued=Number.isSafeInteger(stay.amountCents)&&stay.amountCents>=0;
    const nights=end-start;
    const perNight=valued?Math.floor(stay.amountCents/nights):0;
    const remainder=valued?stay.amountCents%nights:0;
    for(const row of rows){
      const from=Math.max(start,row.start),to=Math.min(end,row.end);
      if(to<=from)continue;
      if(!valued){row.missingIds.add(stay.id);missing.add(stay.id);continue;}
      const cents=perNight*(to-from)+Math.max(0,Math.min(to,start+remainder)-from);
      row.totalCents+=cents;
      row.bySource[stay.source in row.bySource?stay.source:"unknown"]+=cents;
      row.stayIds.add(stay.id);counted.add(stay.id);
    }
  }
  const sourceTotals=Object.fromEntries(revenueSources.map(item=>[item.id,rows.reduce((sum,row)=>sum+row.bySource[item.id],0)]));
  return {rows:rows.map(({stayIds,missingIds,...row})=>({...row,stayCount:stayIds.size,missingCount:missingIds.size})),totalCents:rows.reduce((sum,row)=>sum+row.totalCents,0),stayCount:counted.size,missingCount:missing.size,sourceTotals};
}
