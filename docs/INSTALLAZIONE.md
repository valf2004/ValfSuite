# Installazione e pubblicazione

## 1. Requisiti locali

- Git;
- Node.js 22.13 o successivo;
- Corepack e pnpm;
- un file `.env` locale, se si devono provare autenticazione o invio moduli.

## 2. Prima installazione locale

```bash
git clone URL_DEL_REPOSITORY valfsuite
cd valfsuite
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

In PowerShell:

```powershell
git clone URL_DEL_REPOSITORY valfsuite
Set-Location valfsuite
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm dev
```

Aprire l'indirizzo locale mostrato dal comando. Senza credenziali Google, il sito pubblico funziona e l'area riservata segnala che la configurazione è incompleta.

## 3. Configurazione locale

Compilare `.env` partendo da `.env.example`. Non inserire mai segreti nel codice, nei documenti, nei messaggi di commit o nelle segnalazioni di errore.

Per Google OAuth configurare nella Google Cloud Console:

- origine JavaScript di produzione: `https://valfsuite.valfservice.it`;
- URI di reindirizzamento: `https://valfsuite.valfservice.it/api/auth/google/callback`;
- eventuale URI locale separato solo se previsto dal progetto Google e dall'applicazione.

Gli account ammessi si indicano in `AUTHORIZED_ADMIN_EMAILS`, separati da virgole.

## 4. Verifica prima della pubblicazione

```bash
pnpm build
```

Controllare inoltre:

1. home e pagine pubbliche;
2. cambio lingua;
3. layout su telefono e computer;
4. accesso e uscita dall'area riservata;
5. assenza di dati dimostrativi presentati come reali;
6. funzionamento del recapito della richiesta di disponibilità.

## 5. Installazione sulla VM Ubuntu

La configurazione attuale usa `/home/wwwroot/VALFSuite-next`, Docker e Nginx. I seguenti comandi presuppongono un utente di deploy autorizzato e Docker già installato.

```bash
cd /home/wwwroot
git clone URL_DEL_REPOSITORY VALFSuite-next
cd VALFSuite-next
cp .env.example .env
chmod 600 .env
# modificare .env con un editor direttamente sulla VM
docker compose build
docker compose up -d
```

Il file Compose pubblica l'applicazione soltanto su `127.0.0.1:8095`; non va esposta direttamente a Internet.

## 6. Nginx e HTTPS

Configurazione equivalente a quella attualmente in produzione:

```nginx
server {
    server_name valfsuite.valfservice.it;

    location / {
        proxy_pass http://127.0.0.1:8095;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/valfsuite.valfservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valfsuite.valfservice.it/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name valfsuite.valfservice.it;
    return 301 https://$host$request_uri;
}
```

Dopo ogni modifica:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Alla prima installazione del certificato si può usare Certbot; sulla VM corrente il certificato esiste già.

## 7. Aggiornamento della produzione

```bash
cd /home/wwwroot/VALFSuite-next
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
curl -I http://127.0.0.1:8095/
curl -I https://valfsuite.valfservice.it/
```

Prima dell'aggiornamento creare un tag della versione stabile e verificare che esista una copia recuperabile di `.env` e, quando sarà introdotta, della banca dati.

## 8. Repository Git privato

La cartella locale è già inizializzata. Dopo aver creato un repository remoto privato e vuoto:

```bash
git add .
git status
git commit -m "Versione iniziale VALF Suite"
git remote add origin URL_DEL_REPOSITORY
git push -u origin main
```

Prima del commit verificare sempre che `git status` non mostri `.env`, chiavi SSH, archivi di deploy o copie di database.

Flusso consigliato:

- `main`: versione pubblicabile;
- un ramo breve per ogni nuova funzione o correzione;
- revisione e compilazione prima dell'unione;
- tag `v1.0.0`, `v1.1.0` e così via per le versioni distribuite;
- repository privato con autenticazione a due fattori.

## 9. Diagnostica essenziale

```bash
docker compose ps
docker compose logs --tail=200
curl -I http://127.0.0.1:8095/
sudo nginx -t
sudo journalctl -u nginx --since "30 minutes ago"
```

I log non devono contenere password, token OAuth, documenti o dati completi degli ospiti.
