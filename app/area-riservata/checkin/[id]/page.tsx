import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCheckinSubmission, listAvailabilityRequests, listCheckinDocuments } from "../../../../db/availability";
import { GuestCheckin } from "../../../checkin/GuestCheckin";
import { PrivateLogin } from "../../../area-privata/PrivateChrome";
import { authIsConfigured, privateUserFromCookie } from "../../../lib/google-auth";
import {listAlloggiatiLookupValues} from "../../../../db/alloggiati-lookups";

export const metadata:Metadata={title:"Check-in operatore | VALF Suite",robots:{index:false,follow:false}};

export default async function OperatorCheckinPage({params}:{params:Promise<{id:string}>}){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  const {id}=await params;
  const item=(await listAvailabilityRequests()).find(row=>row.id===id);
  if(!item||!["accepted","checked_in"].includes(item.status))return <main className="checkin-page"><section className="checkin-complete"><p className="eyebrow">Area riservata</p><h1>Check-in non disponibile</h1><p>La prenotazione non esiste oppure non si trova in uno stato compatibile con il check-in.</p><a className="button" href="/area-riservata">Torna all’area riservata</a></section></main>;
  const [draft,lookups,documents]=await Promise.all([getCheckinSubmission(item.id),listAlloggiatiLookupValues(),listCheckinDocuments(item.id)]);
  return <GuestCheckin operatorMode submitUrl={`/api/gestione/checkin/${item.id}`} lookups={lookups} existingDocuments={documents.map(document=>({id:document.id,name:document.originalName,size:document.size}))} booking={{id:item.id,firstName:item.firstName,lastName:item.lastName,name:item.name,arrivalDate:item.arrivalDate,departureDate:item.departureDate,guestCount:item.guestCount,language:item.language,draft}}/>;
}
