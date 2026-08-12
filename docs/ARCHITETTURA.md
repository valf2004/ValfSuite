# Architettura tecnica

## Panoramica

VALF Suite è un'applicazione TypeScript basata su React 19 e vinext. La produzione corrente usa un contenitore Docker su una VM Ubuntu, esposto da Nginx tramite HTTPS.

```text
Browser
  │ HTTPS
  ▼
Nginx + Let's Encrypt
  │ proxy 127.0.0.1:8095
  ▼
Container Docker valfsuite_next
  │ vinext, porta 3000
  ├─ sito pubblico multilingue
  ├─ API richiesta disponibilità
  ├─ autenticazione Google OAuth
  └─ area riservata e pre-check-in dimostrativi
```

## Componenti principali

| Percorso | Responsabilità |
|---|---|
| `app/SitePage.tsx` | Contenuti, lingue, navigazione e modulo disponibilità |
| `app/[[...segments]]/page.tsx` | Risoluzione delle pagine e delle lingue |
| `app/api/disponibilita/route.ts` | Validazione minima e inoltro della richiesta a un webhook |
| `app/area-riservata/page.tsx` | URL pubblico principale dell'area riservata |
| `app/area-privata/page.tsx` | Login e pannello di gestione dimostrativo |
| `app/checkin/[token]/page.tsx` | Modulo di pre-check-in ospite |
| `app/lib/google-auth.ts` | Configurazione OAuth, verifica account e sessioni firmate |
| `app/api/auth/google/*` | Avvio e ritorno del flusso Google OAuth |
| `public/` | Logo, icone, immagine social e fotografie dei dintorni |
| `docker-compose.yml` | Esecuzione del servizio sulla porta locale 8095 |

`/area-privata` è mantenuto come alias tecnico. Il nome visibile e l'URL da utilizzare sono `/area-riservata`. `/gestione/checkin` reindirizza allo stesso pannello.

## Autenticazione

1. L'utente seleziona “Continua con Google”.
2. Il server crea `state`, `nonce` e PKCE verifier temporanei.
3. Google restituisce un codice al callback HTTPS configurato.
4. Il server verifica firma, destinatario, nonce ed email verificata.
5. L'email deve essere presente in `AUTHORIZED_ADMIN_EMAILS`.
6. Il server crea una sessione firmata valida otto ore in un cookie `HttpOnly`, `Secure` e `SameSite=Lax`.

La password Google non transita nel sito. Client secret e segreto di sessione devono esistere solo nell'ambiente di produzione.

## Dati e persistenza

Al momento non esiste una banca dati attiva. Il modello Drizzle è vuoto e `.openai/hosting.json` non dichiara risorse D1 o R2. Il pannello e il pre-check-in mostrano esclusivamente dati dimostrativi.

Prima di raccogliere dati reali occorre scegliere esplicitamente il sistema di persistenza. Per l'attuale VM è consigliabile PostgreSQL con volume separato, backup cifrati e accesso soltanto dalla rete Docker. Un'alternativa gestita è possibile, purché siano definite localizzazione, accordi, backup e controllo degli accessi.

## Variabili d'ambiente

| Variabile | Obbligatoria | Uso |
|---|---:|---|
| `AVAILABILITY_WEBHOOK_URL` | Per il modulo | Destinazione delle richieste di disponibilità |
| `GOOGLE_OAUTH_CLIENT_ID` | Sì, area riservata | Identificativo dell'app Google |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Sì, area riservata | Segreto dell'app Google |
| `GOOGLE_OAUTH_REDIRECT_URI` | Sì | Callback OAuth pubblico |
| `AUTH_SESSION_SECRET` | Sì | Firma delle sessioni, minimo 32 caratteri casuali |
| `AUTHORIZED_ADMIN_EMAILS` | Sì | Lista separata da virgole degli account ammessi |

Il file `.env.example` contiene soltanto nomi e valori non riservati. Il file `.env` è escluso da Git.

## Produzione corrente

- sistema operativo: Ubuntu 24.04.3 LTS;
- Docker Engine 29.1.3 e Docker Compose 2.40.3;
- Nginx 1.24;
- sorgenti di produzione: `/home/wwwroot/VALFSuite-next`;
- contenitore: `valfsuite_next`;
- servizio applicativo: `127.0.0.1:8095`;
- dominio: `valfsuite.valfservice.it`;
- certificato: Let's Encrypt.

La cartella `.openai` è conservata per compatibilità con l'ambiente di sviluppo Sites, ma la produzione corrente è la VM Docker descritta sopra.
