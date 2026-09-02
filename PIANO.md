# Piano di lavoro -- SaaS saloni/centri estetici

Riferimento studiato: https://estetia.tidycode.it/ (analisi in `docs/analisi-estetia.md`).
Obiettivo: non copiarlo, superarlo -- vedi il messaggio originale del progetto per la lista
completa dei 33 punti richiesti. Qui sotto sono organizzati in fasi eseguibili in sequenza,
ciascuna con un criterio chiaro di "fatta" prima di passare alla successiva (niente teoria,
solo cose costruite e verificate -- stesso metodo usato nell'audit del progetto precedente).

## Perché a fasi e non tutto insieme
Fondamenta sbagliate (schema dati, isolamento multi-tenant) si ripagano care più avanti --
un bug di isolamento tra saloni scoperto dopo aver costruito CRM/dashboard sopra costringe a
rifare anche quelli. Si costruisce dal basso verso l'alto.

## Fase 0 -- Fondamenta (IN CORSO)
- [x] Repo Git inizializzato
- [x] Stack scelto: Next.js (App Router) + Supabase (Postgres/Auth/RLS/Storage) + Tailwind + Stripe
- [x] Schema database multi-tenant iniziale con RLS (`supabase/migrations/0001_init.sql`)
- [x] Build verificata in ambiente cloud pulito (risolto problema EPERM della cartella Desktop)
- [ ] Progetto Supabase reale creato e collegato (serve un account Supabase -- vedi sotto)
- [ ] Migrazione applicata e verificata su un database vero
- [ ] Autenticazione base (registrazione/login) funzionante
- [ ] Provisioning automatico: alla registrazione viene creato un tenant + profilo owner

## Fase 1 -- Booking engine (punti 12, 13, 14)
Un solo motore di disponibilità/prenotazione, usato sia dal calendario manuale sia dall'AI.
- [ ] Calcolo disponibilità reale (orari, pause, ferie, operatore, durata servizio, buffer)
- [ ] Creazione/cancellazione/modifica appuntamento con verifica anti-conflitto (già a livello
      di database con il vincolo `niente_sovrapposizioni`, più il controllo applicativo)
- [ ] Gestione servizi consecutivi, operatore non specificato, cliente nuovo/esistente
- [ ] Test su tutti gli scenari del punto 30 rilevanti alla prenotazione

## Fase 2 -- AI conversazionale (punti 9, 10, 11, 17)
Canale di default: **chat web** integrata nella pagina pubblica del salone (nessuna
approvazione esterna, funziona dal minuto zero) + Telegram opzionale. WhatsApp resta
disponibile come canale "connetti il tuo numero" quando l'Embedded Signup Meta è pronto --
vedi `docs/verifica-stack-automazione.md` per il perché di questa scelta (l'unico punto del
funnel self-service che dipende da un'approvazione esterna a Meta, non dallo stack).
- [ ] Architettura tool-calling: AI interpreta, il backend decide (pattern già validato nel
      progetto precedente con `cervello.py` -- lo riprendiamo, non lo reinventiamo)
- [ ] Contesto di conversazione persistente in `conversazioni.slot_in_costruzione`
- [ ] Canale chat web -> AI -> booking engine -> risposta (motore condiviso con tutti i canali)
- [ ] Collegamento webhook WhatsApp/Telegram -> stesso motore, quando attivati per il tenant
- [ ] Test sugli scenari di conversazione ambigua/interrotta/multi-servizio

## Fase 3 -- CRM e Dashboard (punti 15, 21, 22)
- [ ] Anagrafica cliente con storico completo
- [ ] Dashboard con metriche reali (non finte) e insight (slot liberi, clienti inattivi)
- [ ] Analytics: revenue, retention, no-show, occupazione

## Fase 4 -- Pagina pubblica, foto, PWA (punti 18, 19, 20)
- [ ] Pagina pubblica per-salone generata automaticamente, condivisibile
- [ ] Galleria/upload immagini (Supabase Storage)
- [ ] PWA installabile, notifiche push dove supportato

## Fase 5 -- Billing self-service e admin panel (punti 6, 7, 23, 24)
- [ ] Checkout Stripe, webhook, gestione stato abbonamento, feature gating per piano
- [ ] Piani Free -> Enterprise progettati (non copiati) con limiti applicati tecnicamente
- [ ] Pannello admin per te: saloni, abbonamenti, utilizzo, interventi manuali quando serve

## Fase 6 -- Automazioni e rifinitura (punti 16, 26, 27, 29, 30)
- [ ] Motore di automazioni configurabili (reminder, follow-up, inattività, compleanno)
- [ ] Revisione sicurezza (RLS, permessi tool AI, rate limiting, input validation)
- [ ] Test completo su tutti gli scenari del punto 30
- [ ] Rifinitura UI/UX

---

## Cosa serve da te per sbloccare la Fase 0
1. **Un progetto Supabase** (gratuito per iniziare): crea un account su supabase.com, crea un
   nuovo progetto, e passami URL del progetto + `anon key` + `service_role key` (quest'ultima
   MAI nel browser/frontend -- solo lato server). Senza questo non posso applicare né testare
   davvero lo schema che ho scritto. Verificato anche che non ho un Supabase CLI/Docker
   utilizzabile né sul tuo Mac né nel sandbox cloud per simulare un database locale --
   serve per forza un progetto vero su supabase.com.
2. **Un account Stripe** (anche di test per ora) quando arriviamo alla Fase 5.
3. Le credenziali che già avevi (WhatsApp, Google Calendar/service account, Anthropic) restano
   valide e vanno semplicemente ricopiate in `.env.local` di questo progetto (vedi `.env.example`).
