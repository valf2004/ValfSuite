import type {Metadata} from "next";
import {headers} from "next/headers";
import {listAvailabilityRequests} from "../../../db/availability";
import {PrivateHeader,PrivateLogin} from "../../area-privata/PrivateChrome";
import RevenueStatistics from "../../area-privata/RevenueStatistics";
import {authIsConfigured,privateUserFromCookie} from "../../lib/google-auth";
import {todayAtProperty} from "../../lib/property-date";
import {prepareRevenueStays} from "../../lib/revenue-statistics.mjs";
import "../../area-privata/revenue-statistics.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Statistiche ricavi | VALF Suite",robots:{index:false,follow:false}};

export default async function StatisticsPage(){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  let stays;
  try{stays=prepareRevenueStays(await listAvailabilityRequests());}
  catch(error){console.error("revenue_statistics_load_failed",error instanceof Error?error.message:"unknown");return <main className="dashboard-page"><PrivateHeader user={user} active="statistics"/><section className="revenue-panel"><h1>Statistiche</h1><p role="alert">Non è stato possibile caricare i ricavi. Ricarica la pagina per riprovare.</p></section></main>;}
  return <main className="dashboard-page"><PrivateHeader user={user} active="statistics"/><RevenueStatistics stays={stays} today={todayAtProperty()}/></main>;
}
