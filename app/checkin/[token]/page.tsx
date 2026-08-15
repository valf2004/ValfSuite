import { GuestCheckin } from "../GuestCheckin";
import {listAvailabilityRequests} from "../../../db/availability";
import {verifyCheckinToken} from "../../lib/checkin-token";

export const dynamic="force-dynamic";

export default async function CheckinPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  if(token==="demo")return <GuestCheckin/>;
  const requestId=await verifyCheckinToken(token);
  const item=requestId?(await listAvailabilityRequests()).find(row=>row.id===requestId):null;
  if(!item||!["accepted","checked_in"].includes(item.status))return <main className="checkin-page"><section className="checkin-complete"><p className="eyebrow">VALF Suite</p><h1>Collegamento non disponibile</h1><p>Il collegamento non è valido, è scaduto oppure il check-in non è ancora disponibile.</p><a className="button" href="/">Torna al sito</a></section></main>;
  return <GuestCheckin token={token} booking={{id:item.id,name:item.name,arrivalDate:item.arrivalDate,departureDate:item.departureDate,guestCount:item.guestCount,language:item.language,alreadyCompleted:item.status==="checked_in"}}/>;
}
