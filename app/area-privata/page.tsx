import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listAvailabilityEvents, listAvailabilityRequests, type AvailabilityEvent, type AvailabilityRecord } from "../../db/availability";
import { authIsConfigured, privateUserFromCookie } from "../lib/google-auth";
import RequestsDashboard from "./RequestsDashboard";
import { PrivateHeader, PrivateLogin } from "./PrivateChrome";
import {todayAtProperty} from "../lib/property-date";

export const dynamic = "force-dynamic";

export default async function PrivateAreaPage({searchParams}:{searchParams?:Promise<{sessione?:string|string[];errore?:string|string[]}>}) {
  const requestHeaders = await headers();
  const host=(requestHeaders.get("x-forwarded-host")||requestHeaders.get("host")||"").split(",")[0].trim().toLowerCase();
  if(host.endsWith(".chatgpt.site"))redirect("https://valfsuite.valfservice.it/area-riservata");
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  const query=searchParams?await searchParams:{};
  if (!user) return <PrivateLogin configured={authIsConfigured()} sessionExpired={query.sessione==="scaduta"} loginError={typeof query.errore==="string"?query.errore:undefined}/>;
  const [requests,events] = await Promise.all([listAvailabilityRequests(),listAvailabilityEvents()]);
  return <PrivateDashboard user={user} requests={requests} events={events}/>;
}

function PrivateDashboard({user,requests,events}:{user:{email:string;name:string;picture?:string};requests:AvailabilityRecord[];events:AvailabilityEvent[]}) {
  return <main className="dashboard-page">
    <PrivateHeader user={user} active="requests"/>
    <RequestsDashboard initialRequests={requests} initialEvents={events} today={todayAtProperty()}/>
  </main>;
}
