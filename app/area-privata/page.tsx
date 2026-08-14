import { headers } from "next/headers";
import { listAvailabilityRequests, type AvailabilityRecord } from "../../db/availability";
import { authIsConfigured, privateUserFromCookie } from "../lib/google-auth";
import RequestsDashboard from "./RequestsDashboard";

export const dynamic = "force-dynamic";

export default async function PrivateAreaPage() {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return <PrivateLogin configured={authIsConfigured()}/>;
  const requests = await listAvailabilityRequests();
  return <PrivateDashboard user={user} requests={requests}/>;
}

function PrivateLogin({configured}:{configured:boolean}) {
  return <main className="private-login"><header><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section><p className="eyebrow">Accesso riservato</p><h1>Area riservata</h1><p>Gestione dei check-in e delle comunicazioni degli ospiti. L’accesso è consentito esclusivamente agli account autorizzati.</p>{configured ? <a className="google-login" href="/api/auth/google/start"><span>G</span>Continua con Google</a> : <div className="private-config"><strong>Configurazione in corso</strong><p>Il collegamento con Google non è ancora attivo. Inserisci Client ID e Client Secret sulla VM per completare l’attivazione.</p></div>}<small>VALF Suite non riceve né conserva la password del tuo account Google.</small></section></main>;
}

function PrivateDashboard({user,requests}:{user:{email:string;name:string;picture?:string};requests:AvailabilityRecord[]}) {
  return <main className="dashboard-page">
    <header className="dashboard-header"><div className="dashboard-brand"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a><p>Area riservata <span>· Gestione soggiorni</span></p></div><div className="private-account"><span><strong>{user.name}</strong><small>{user.email}</small></span><a href="/api/auth/logout">Esci</a></div></header>
    <RequestsDashboard initialRequests={requests}/>
  </main>;
}
