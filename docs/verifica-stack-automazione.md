# Verifica: lo stack scelto regge il "zero intervento manuale"?

Controllo esplicito richiesto prima di continuare: lo stack (Next.js + Supabase + Stripe +
Anthropic + WhatsApp Cloud API) deve permettere che OGNI nuovo salone, dalla registrazione
all'operatività, avvenga senza che io (Gabriel) debba toccare nulla a mano. Verifica punto
per punto, con verdetto onesto -- non do per scontato che "si può fare" senza controllarlo.

## Cosa regge al 100%, in automatico, per ogni nuovo salone

| Passo | Come | Automatico? |
|---|---|---|
| Registrazione account | Supabase Auth (email/password o magic link) | Sì, nessun intervento |
| Creazione tenant + profilo owner | Trigger Postgres su `auth.users` (AFTER INSERT) che crea la riga in `tenants` + `profiles` | Sì, succede nello stesso istante della registrazione |
| Scelta piano + pagamento | Stripe Checkout (pagina ospitata da Stripe, carta del cliente) | Sì, nessun intervento |
| Attivazione abbonamento/piano | Webhook Stripe -> Edge Function Supabase -> aggiorna `tenants.piano`/`stato_abbonamento` | Sì, in tempo reale, automatico |
| Limiti del piano applicati (feature gating) | Controllo lato server (route/API) sul campo `piano` del tenant + conteggi reali (clienti/appuntamenti) | Sì, tecnico non "a fiducia" |
| Onboarding (orari, operatori, servizi, foto\*) | Form self-service, scrivono via RLS solo sul proprio tenant | Sì (foto: architettura sì, non ancora costruito) |
| Pagina pubblica del salone | Route dinamica `/s/[slug]` letta dal DB -- stesso codice per tutti i saloni | Sì, nessun deploy/config manuale per salone |
| Calendario/CRM/Dashboard/Analytics | Query sul DB filtrate per tenant | Sì, nessun intervento |
| AI conversazionale (booking engine) | Un system prompt "template" riempito con i dati del tenant (servizi/orari/operatori) + tool-calling verso lo stesso booking engine di tutti | Sì, nessun prompt scritto a mano per salone |
| PWA installabile\* | Manifest + service worker condivisi, dati per-tenant | Sì (architettura sì, non ancora costruito) |

Nessuno di questi passaggi richiede che io intervenga a mano per un cliente specifico --
è tutto "un salone in più" = "righe in più nello stesso database", non codice o config nuovi.

\* **Nota aggiunta 12/09/2026, per chiarezza**: questa tabella è una verifica ARCHITETTURALE
("se lo costruiamo così, regge senza intervento manuale?"), non un log di cosa esiste già oggi
-- foto/galleria e PWA sono ancora a zero codice (vedi PROJECT_STATUS.md, "Cosa è mock,
incompleto o non ancora iniziato"). Il "Sì" qui sopra vale per l'architettura scelta quando
verranno costruiti, non per lo stato attuale.

## L'unico punto che NON regge al 100% subito: numero WhatsApp per-salone

Qui devo essere diretto: collegare il numero WhatsApp del NUOVO salone in automatico, senza
che io tocchi nulla su Meta, richiede il prodotto Meta chiamato **Embedded Signup** (il
cliente collega il proprio numero WhatsApp Business dentro la nostra app, con un flusso
OAuth-like, zero lavoro nostro per singolo cliente). Ma Embedded Signup richiede PRIMA, una
tantum per la nostra azienda (non per ogni cliente): business verification su Meta Business
Suite + App Review dell'app Meta. Questo non è ancora stato avviato (l'avevamo già messo in
pausa in attesa della P.IVA). Finché non è fatto, l'alternativa sarebbe aggiungere il numero
di ogni nuovo cliente a mano su Meta Business Manager -- pochi minuti, ma è comunque un
intervento manuale mio, in contraddizione con l'obiettivo dichiarato.

**Decisione presa (per non bloccare tutto il resto sull'unico pezzo che dipende da Meta):**
il canale di conversazione di default nel prodotto self-service è una **chat web integrata
nella pagina pubblica del salone** (nessuna approvazione esterna, funziona dal minuto zero,
stesso motore AI/booking di WhatsApp) + possibilità di aggiungere Telegram (bot unico,
instradato per tenant via parametro, zero approvazione Meta). **WhatsApp resta un canale
aggiuntivo "Connetti il tuo numero"**, disponibile per i clienti non appena Embedded Signup
è pronto (task nel backlog, non bloccante per il resto del prodotto). Così il funnel
registrazione -> pagamento -> operativo resta al 100% senza intervento manuale fin da subito,
e WhatsApp si aggiunge sopra quando la parte Meta è sbloccata.

## Altri limiti onesti da tenere a mente (non bloccanti, ma reali)
- I **template di messaggio Meta** (promemoria/notifiche fuori dalla finestra di 24h) restano
  approvati UNA volta per template condiviso (non per cliente) -- non è un problema di scala,
  ma vanno scritti in modo generico fin da subito (placeholder, non testo specifico di un
  salone).
- **Stripe in Italia**: un account Stripe per incassare pagamenti veri richiede dati fiscali
  reali (coerente con "pubblico appena ho la P.IVA", già la tua decisione -- nessun cambiamento
  qui, si può comunque sviluppare e testare tutto in modalità test di Stripe prima).
- **Scala**: Supabase/Postgres con RLS su un solo database multi-tenant regge tranquillamente
  fino a decine di migliaia di saloni con questo schema (non serve un database per cliente);
  se in futuro servisse più isolamento fisico per un cliente enterprise, si può migrare quel
  singolo tenant senza toccare gli altri.

## Verdetto
Sì, lo stack scelto permette il funnel completo automatico richiesto, con la sola eccezione
del collegamento diretto del numero WhatsApp per-cliente (dipendenza esterna da Meta, non
dallo stack). Soluzione decisa sopra per non farne un blocco: chat web + Telegram da subito,
WhatsApp "aggiungi il tuo numero" quando pronto.
