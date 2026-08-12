import { headers } from "next/headers";
import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { availabilityRequests } from "../../db/schema";
import { authIsConfigured, privateUserFromCookie } from "../lib/google-auth";
import RequestsDashboard from "./RequestsDashboard";

export const dynamic = "force-dynamic";

export default async function PrivateAreaPage() {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return <PrivateLogin configured={authIsConfigured()}/>;
  const requests = await getDb().select().from(availabilityRequests).orderBy(desc(availabilityRequests.createdAt));
  return <PrivateDashboard user={user} requests={requests}/>;
}

function PrivateLogin({configured}:{configured:boolean}) {
  return <main className="private-login"><header><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section><p className="eyebrow">Accesso riservato</p><h1>Area riservata</h1><p>Gestione dei check-in e delle comunicazioni degli ospiti. L’accesso è consentito esclusivamente agli account autorizzati.</p>{configured ? <a className="google-login" href="/api/auth/google/start"><span>G</span>Continua con Google</a> : <div className="private-config"><strong>Configurazione in corso</strong><p>Il collegamento con Google non è ancora attivo. Inserisci Client ID e Client Secret sulla VM per completare l’attivazione.</p></div>}<small>VALF Suite non riceve né conserva la password del tuo account Google.</small></section></main>;
}

type StoredRequest = typeof availabilityRequests.$inferSelect;
function PrivateDashboard({user,requests}:{user:{email:string;name:string;picture?:string};requests:StoredRequest[]}) {
  return <main className="dashboard-page">
    <header className="dashboard-header"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a><div className="private-account"><span><strong>{user.name}</strong><small>{user.email}</small></span><a href="/api/auth/logout">Esci</a></div></header>
    <section className="dashboard-title"><div><p className="eyebrow">Area riservata · Gestione soggiorni</p><h1>Richieste e prenotazioni</h1><p>Segui ogni richiesta dalla ricezione fino alla conferma o all’archiviazione.</p></div></section>
    <RequestsDashboard initialRequests={requests}/>
  </main>;
}
