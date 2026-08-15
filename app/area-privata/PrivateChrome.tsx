export function PrivateLogin({configured}:{configured:boolean}) {
  return <main className="private-login"><header><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section><p className="eyebrow">Accesso riservato</p><h1>Area riservata</h1><p>Gestione dei check-in e delle comunicazioni degli ospiti. L’accesso è consentito esclusivamente agli account autorizzati.</p>{configured ? <a className="google-login" href="/api/auth/google/start"><span>G</span>Continua con Google</a> : <div className="private-config"><strong>Configurazione in corso</strong><p>Il collegamento con Google non è ancora attivo. Inserisci Client ID e Client Secret sulla VM per completare l’attivazione.</p></div>}<small>VALF Suite non riceve né conserva la password del tuo account Google.</small></section></main>;
}

export function PrivateHeader({user,active}:{user:{email:string;name:string;picture?:string};active:"requests"|"calendar"}) {
  return <header className="dashboard-header">
    <div className="dashboard-brand"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a><p>Area riservata <span>· Gestione soggiorni</span></p></div>
    <div className="dashboard-header-actions">
      <nav className="dashboard-nav" aria-label="Area riservata"><a className={active==="requests"?"active":""} aria-current={active==="requests"?"page":undefined} href="/area-riservata">Richieste</a><a className={active==="calendar"?"active":""} aria-current={active==="calendar"?"page":undefined} href="/area-riservata/calendario">Calendario</a></nav>
      <div className="private-account"><span><strong>{user.name}</strong><small>{user.email}</small></span><a href="/api/auth/logout">Esci</a></div>
    </div>
  </header>;
}
