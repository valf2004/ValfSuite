import { GuestCheckin } from "../GuestCheckin";
import Link from "next/link";
import {getCheckinSubmission,listAvailabilityRequests,listCheckinDocuments} from "../../../db/availability";
import {verifyCheckinToken} from "../../lib/checkin-token";
import {listAlloggiatiLookupValues} from "../../../db/alloggiati-lookups";

export const dynamic="force-dynamic";

export default async function CheckinPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  if(token==="demo")return <GuestCheckin/>;
  const requestId=await verifyCheckinToken(token);
  const item=requestId?(await listAvailabilityRequests()).find(row=>row.id===requestId):null;
  if(!item||!["accepted","checked_in"].includes(item.status))return <main className="checkin-page"><section className="checkin-complete"><p className="eyebrow">VALF Suite</p><h1>Collegamento non disponibile</h1><p>Il collegamento non è valido, è scaduto oppure il check-in non è ancora disponibile.</p><Link className="button" href="/">Torna al sito</Link></section></main>;
  const [draft,lookups,documents]=await Promise.all([getCheckinSubmission(item.id),listAlloggiatiLookupValues(),listCheckinDocuments(item.id)]);
  if(draft?.sendAttemptedAt)return <main className="checkin-page"><section className="checkin-complete"><p className="eyebrow">VALF Suite</p><h1>Check-in non modificabile</h1><p>È già stato avviato l’invio dei dati ad Alloggiati Web. Per eventuali correzioni contatta Angela.</p><Link className="button" href="/">Torna al sito</Link></section></main>;
  return <GuestCheckin token={token} lookups={lookups} existingDocuments={documents.map(document=>({id:document.id,name:document.originalName,size:document.size}))} booking={{id:item.id,firstName:item.firstName,lastName:item.lastName,name:item.name,arrivalDate:item.arrivalDate,departureDate:item.departureDate,guestCount:item.guestCount,language:item.language,draft}}/>;
}
