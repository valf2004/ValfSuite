import type { Metadata } from "next";
import { headers } from "next/headers";
import { listAvailabilityRequests } from "../../../../db/availability";
import { GuestCheckin } from "../../../checkin/GuestCheckin";
import { PrivateLogin } from "../../../area-privata/PrivateChrome";
import { authIsConfigured, privateUserFromCookie } from "../../../lib/google-auth";

export const metadata:Metadata={title:"Check-in operatore | VALF Suite",robots:{index:false,follow:false}};

export default async function OperatorCheckinPage({params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  const {id}=await params;
  const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||!["accepted","checked_in"].includes(item.status))return <main className="checkin-page"><section className="checkin-complete"><p className="eyebrow">Area riservata</p><h1>Check-in non disponibile</h1><p>La prenotazione non esiste oppure non si trova in uno stato compatibile con il check-in.</p><a className="button" href="/area-riservata">Torna all’area riservata</a></section></main>;
  return <GuestCheckin operatorMode submitUrl={`/api/gestione/checkin/${item.id}`} booking={{id:item.id,name:item.name,arrivalDate:item.arrivalDate,departureDate:item.departureDate,guestCount:item.guestCount,language:item.language,alreadyCompleted:item.status==="checked_in"}}/>;
}
