import { headers } from "next/headers";
import { authIsConfigured, privateUserFromCookie } from "../lib/google-auth";

export const dynamic = "force-dynamic";

export default async function PrivateAreaPage() {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return <PrivateLogin configured={authIsConfigured()}/>;
  return <PrivateDashboard user={user}/>;
}

function PrivateLogin({configured}:{configured:boolean}) {
  return <main className="private-login"><header><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section><p className="eyebrow">Accesso riservato</p><h1>Area riservata</h1><p>Gestione dei check-in e delle comunicazioni degli ospiti. L’accesso è consentito esclusivamente agli account autorizzati.</p>{configured ? <a className="google-login" href="/api/auth/google/start"><span>G</span>Continua con Google</a> : <div className="private-config"><strong>Configurazione in corso</strong><p>Il collegamento con Google non è ancora attivo. Inserisci Client ID e Client Secret sulla VM per completare l’attivazione.</p></div>}<small>VALF Suite non riceve né conserva la password del tuo account Google.</small></section></main>;
}

function PrivateDashboard({user}:{user:{email:string;name:string;picture?:string}}) {
  return <main className="dashboard-page">
    <header className="dashboard-header"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a><div className="private-account"><span><strong>{user.name}</strong><small>{user.email}</small></span><a href="/api/auth/logout">Esci</a></div></header>
    <section className="dashboard-title"><div><p className="eyebrow">Area riservata · Gestione ospiti</p><h1>Check-in</h1><p>Controlla le pratiche, verifica personalmente i documenti e gestisci la comunicazione ad Alloggiati Web.</p></div><a className="button" href="/checkin/demo">Apri modulo ospite</a></section>
    <section className="dashboard-stats"><article><small>Arrivi oggi</small><strong>1</strong><span>2 ospiti previsti</span></article><article><small>Da completare</small><strong>1</strong><span>Dati ospite mancanti</span></article><article><small>Da verificare</small><strong>1</strong><span>Documento da controllare</span></article><article><small>Inviati</small><strong>0</strong><span>Alloggiati Web non collegato</span></article></section>
    <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Prossimi arrivi</p><h2>Pratiche aperte</h2></div><label>Cerca<input type="search" placeholder="Nome o codice"/></label></div><article className="booking-row"><div className="booking-date"><strong>18</strong><span>AGO</span></div><div><small>VALF-DEMO-01</small><h3>Ospite dimostrativo</h3><p>2 ospiti · 18–21 agosto · 3 notti</p></div><span className="status status-review">Da verificare</span><a href="#pratica">Apri →</a></article></section>
    <section className="practice-panel" id="pratica"><div><p className="eyebrow">VALF-DEMO-01</p><h2>Controllo e invio</h2><p>Il passaggio di verifica personale resta obbligatorio prima della trasmissione.</p></div><ol className="practice-steps"><li className="done"><span>✓</span><div><strong>Dati ricevuti</strong><small>Modulo ospite completato</small></div></li><li><span>2</span><div><strong>Identità verificata all’arrivo</strong><small>Confronta ogni persona con il documento originale</small></div><button>Conferma verifica</button></li><li className="disabled"><span>3</span><div><strong>Controllo Alloggiati Web</strong><small>Disponibile dopo l’attivazione della WSKEY</small></div><button disabled>Controlla</button></li><li className="disabled"><span>4</span><div><strong>Invio e ricevuta</strong><small>Credenziali Alloggiati Web non configurate</small></div><button disabled>Invia</button></li></ol></section>
    <aside className="integration-notice"><span>i</span><div><strong>Collegamento con la Questura non ancora attivo</strong><p>Quando avrai le credenziali, configureremo utente, password e WSKEY esclusivamente sul server.</p></div></aside>
  </main>;
}
