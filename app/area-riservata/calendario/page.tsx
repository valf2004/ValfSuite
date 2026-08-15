import type {Metadata} from "next";
import {headers} from "next/headers";
import {listAvailabilityEvents,listAvailabilityRequests} from "../../../db/availability";
import BookingCalendar from "../../area-privata/BookingCalendar";
import {PrivateHeader,PrivateLogin} from "../../area-privata/PrivateChrome";
import {authIsConfigured,privateUserFromCookie} from "../../lib/google-auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Calendario prenotazioni | VALF Suite",robots:{index:false,follow:false}};

export default async function CalendarPage(){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  const [requests,events]=await Promise.all([listAvailabilityRequests(),listAvailabilityEvents()]);
  return <main className="dashboard-page"><PrivateHeader user={user} active="calendar"/><BookingCalendar initialRequests={requests} events={events} today={new Date().toISOString().slice(0,10)}/></main>;
}
