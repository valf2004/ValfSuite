# Funzionalità e roadmap

Stato rilevato l'11 agosto 2026. Questo documento distingue ciò che è realmente operativo dalle schermate dimostrative.

## Funzionalità disponibili

| Area | Stato | Note |
|---|---|---|
| Sito pubblico | Operativo | Home e pagine informative responsive |
| Cinque lingue | Operativo | IT, EN, FR, ES e DE |
| Servizi e dintorni | Operativo | Otto località con fotografie |
| Galleria della casa | Parziale | Struttura pronta, fotografie definitive mancanti |
| Contatti | Operativo | Telefono, WhatsApp ed email ufficiale |
| Richiesta disponibilità | Parziale | Il modulo esiste, ma il canale di consegna non è configurato |
| Area riservata | Operativo | Accesso Google limitato agli indirizzi autorizzati |
| Pannello check-in | Dimostrativo | Dati, conteggi e pratica sono fittizi |
| Modulo ospite | Dimostrativo | Compilabile in cinque lingue, ma non salva né trasmette dati |
| Alloggiati Web | Non attivo | In attesa delle credenziali e della WSKEY |

## Funzionalità mancanti

### Priorità P0 — necessarie prima di usare dati reali degli ospiti

1. **F-01 — Consegna delle richieste di disponibilità**  
   Collegare il modulo a email o a un servizio affidabile, aggiungere conferma all'utente, gestione errori, limitazione degli abusi e registrazione minima degli invii.

2. **F-02 — Archivio protetto**  
   Creare la banca dati per soggiorni, ospiti, stati della pratica, ricevute e log delle operazioni. Definire backup e ripristino prima dell'uso.

3. **F-03 — Gestione reale delle pratiche**  
   Creazione, modifica, ricerca e chiusura dei soggiorni; stati “da compilare”, “ricevuto”, “verificato”, “inviato” ed “errore”. Eliminare tutti i dati dimostrativi dal pannello.

4. **F-04 — Collegamenti sicuri per gli ospiti**  
   Dopo la conferma del soggiorno, Angela crea o conferma la pratica nell'area riservata. Il sistema genera un link casuale, con scadenza e possibilità di revoca, da inserire nell'email di conferma o in un promemoria pre-arrivo. Il link non deve contenere dati personali né rendere visibili altre pratiche.

5. **F-05 — Pre-check-in persistente**  
   Salvare i dati inseriti, supportare tutti gli ospiti, consentire correzioni controllate e notificare Angela alla compilazione. Validare date, campi e codici richiesti dal flusso Alloggiati Web.

6. **F-06 — Privacy e sicurezza dei dati**  
   Informativa completa, base e finalità del trattamento, tempi di conservazione, cancellazione, controllo degli accessi, cifratura, registro delle attività e procedura in caso di incidente. Prima della messa in esercizio è opportuna una verifica professionale degli aspetti privacy e normativi.

7. **F-07 — Collegamento Alloggiati Web**  
   Configurare le credenziali solo sul server, verificare i dati, trasmettere le schedine, conservare esito e ricevuta e gestire i tentativi falliti. L'invio deve sempre restare subordinato al controllo umano dell'identità.

8. **F-08 — Continuità operativa**  
   Backup automatici, prova periodica di ripristino, log senza dati sensibili, monitoraggio del servizio, aggiornamenti di sicurezza e procedura documentata di rollback.

### Priorità P1 — completamento del sito e del lavoro quotidiano

1. Pubblicare fotografie reali della casa con testi alternativi e ottimizzazione WebP.
2. Correggere e revisionare professionalmente tutte le traduzioni.
3. Aggiungere informativa privacy, eventuale gestione cookie e riferimenti del titolare.
4. Rendere la disponibilità consultabile nel pannello e inviare notifiche email.
5. Aggiungere gestione utenti e ruoli, senza modificare manualmente il file `.env`.
6. Aggiungere ricerca, filtri, ordinamento, storico e scaricamento delle ricevute.
7. Completare SEO multilingue: titoli per pagina, URL canonici, sitemap e dati strutturati.
8. Aggiungere test automatici per autenticazione, moduli, permessi e flussi principali.

### Priorità P2 — prenotazione online completa

1. Calendario con disponibilità, stagioni, soggiorno minimo e blocchi manuali.
2. Preventivo automatico con prezzo, pulizie, imposte e condizioni.
3. Conferma della prenotazione e, se desiderato, pagamento online.
4. Sincronizzazione iCal o channel manager con i portali esterni.
5. Email automatiche prima dell'arrivo e dopo la partenza.
6. Statistiche essenziali e analisi delle conversioni rispettosa della privacy.

## Ordine di realizzazione consigliato

1. Git privato, backup e ambienti separati.
2. Richieste di disponibilità realmente recapitate.
3. Progettazione privacy e modello dati.
4. Archivio, pratiche e link ospite sicuri.
5. Pre-check-in reale.
6. Integrazione Alloggiati Web, quando saranno disponibili credenziali e WSKEY.
7. Prenotazione e pagamento online solo dopo la stabilizzazione del check-in.

Ogni funzione passa da sviluppo locale, verifica, copia di sicurezza e pubblicazione. Il ramo `main` deve rappresentare sempre la versione pronta per la produzione.
