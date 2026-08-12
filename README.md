# VALF Suite

Sito ufficiale di VALF Suite, casa vacanze ad Arcola (SP), con area riservata per la futura gestione di prenotazioni e check-in.

Produzione: <https://valfsuite.valfservice.it>

## Stato del progetto

- sito pubblico in italiano, inglese, francese, spagnolo e tedesco;
- pagine Suite, servizi, galleria, dintorni, disponibilità, contatti e condizioni;
- accesso all'area riservata tramite Google e lista di account autorizzati;
- pre-check-in e pannello di gestione presenti come dimostrazione;
- archiviazione dei dati, notifiche e collegamento Alloggiati Web ancora da realizzare;
- modulo di richiesta disponibilità non ancora collegato a un canale di consegna.

## Documentazione

- [Funzionalità e roadmap](docs/FUNZIONALITA-E-ROADMAP.md)
- [Architettura tecnica](docs/ARCHITETTURA.md)
- [Installazione e pubblicazione](docs/INSTALLAZIONE.md)
- [Manuale d'uso](docs/MANUALE-D-USO.md)

## Avvio locale rapido

Requisiti: Node.js 22.13 o successivo e Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Su Windows PowerShell, usare `Copy-Item .env.example .env` al posto di `cp`.

Per verificare la compilazione:

```bash
pnpm build
```

Le credenziali vanno inserite solo nel file `.env`, che non deve mai essere aggiunto a Git.

## Controllo versione

La cartella è già un repository Git locale. Prima di collegarla a GitHub, GitLab o a un server Git è consigliato creare un repository **privato**, effettuare il primo commit e aggiungere il remoto. Le istruzioni sono in [Installazione e pubblicazione](docs/INSTALLAZIONE.md#repository-git-privato).
