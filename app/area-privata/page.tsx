import { headers } from "next/headers";
import { listAvailabilityEvents, listAvailabilityRequests, type AvailabilityEvent, type AvailabilityRecord } from "../../db/availability";
import { authIsConfigured, privateUserFromCookie } from "../lib/google-auth";
import RequestsDashboard from "./RequestsDashboard";
import { PrivateHeader, PrivateLogin } from "./PrivateChrome";
import {todayAtProperty} from "../lib/property-date";

export const dynamic = "force-dynamic";

export default async function PrivateAreaPage() {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return <PrivateLogin configured={authIsConfigured()}/>;
  const [requests,events] = await Promise.all([listAvailabilityRequests(),listAvailabilityEvents()]);
  return <PrivateDashboard user={user} requests={requests} events={events}/>;
}

function PrivateDashboard({user,requests,events}:{user:{email:string;name:string;picture?:string};requests:AvailabilityRecord[];events:AvailabilityEvent[]}) {
  return <main className="dashboard-page">
    <PrivateHeader user={user} active="requests"/>
    <RequestsDashboard initialRequests={requests} initialEvents={events} today={todayAtProperty()}/>
  </main>;
}
