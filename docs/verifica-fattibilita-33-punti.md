# Verifica di fattibilità sui 33 punti + scelta stack definitiva

Richiesta esplicita: prima di continuare a costruire, verificare che TUTTI gli obiettivi
richiesti siano davvero raggiungibili con lo stack scelto, e che sia il migliore possibile
per questo lavoro (non solo "andrebbe bene"). Risposta diretta punto per punto.

## Verdetto in una riga
Tutti i 33 punti sono tecnicamente raggiungibili con Next.js + Supabase + Stripe + Anthropic
Claude. Nessun punto richiede di cambiare stack di base. Sotto, per ogni area, la parte
specifica di Supabase/libreria da usare (non genericamente "si può fare" -- il pezzo tecnico
concreto) e le uniche due eccezioni reali, già gestite con una decisione (non un blocco).

## Stack confermato, componente per componente

| Esigenza (dai 33 punti) | Come si ottiene, davvero | Perché è la scelta giusta |
|---|---|---|
| Multi-tenant + isolamento dati (p.8) | Postgres + RLS (già nello schema) | Isolamento a livello di database, non fidato al solo codice applicativo -- lo standard per SaaS multi-tenant su Supabase, regge a 10.000+ tenant su un solo DB |
| Calendario aggiornato in tempo reale ovunque (p.14) | **Supabase Realtime** (subscribe alle modifiche della tabella `appuntamenti`) | La prenotazione creata dall'AI appare a schermo nella dashboard senza refresh -- nessun polling da scrivere a mano |
| Automazioni schedulate: reminder 24h, inattività 30gg, compleanno (p.16) | **pg_cron + pg_net** (estensioni Postgres disponibili su Supabase) che chiamano una Edge Function a orari fissi | Non serve un server sempre acceso per i cron -- gira dentro il database stesso |
| Foto/galleria per salone (p.19) | **Supabase Storage** con policy per-tenant | Upload diretto dal browser, URL pubblici per la pagina del salone, stesso sistema di permessi di RLS |
| AI che interpreta, backend che decide (p.10) | **Anthropic tool-calling** (function calling nativo dell'API Claude) -- stesso pattern già validato in `cervello.py` | È esattamente il caso d'uso per cui esiste il tool-calling: il modello propone una chiamata a funzione, il codice la esegue con tutti i controlli reali, il modello vede solo il risultato |
| Prevenzione doppia prenotazione (p.12) | Vincolo `exclude using gist` a livello di database (già nello schema) | Blocca la race condition anche in caso di due richieste concorrenti nello stesso millisecondo -- non dipende dalla logica applicativa |
| Dashboard/Analytics "semplici, leggibili, premium" (p.22) | **Tremor** (componenti grafici pensati per dashboard, nativi Tailwind) invece di una libreria generica come Chart.js | Meno codice per un risultato che sembra già rifinito, coerente con l'estetica Stripe/Linear richiesta |
| UI premium non "da template" (p.28) | **shadcn/ui** + Tailwind (componenti che si copiano nel progetto e si personalizzano, non un tema chiuso) | È lo strumento con cui si costruiscono oggi la maggior parte dei SaaS "premium" citati come riferimento -- non un pacchetto di componenti riconoscibili |
| PWA installabile, notifiche push (p.20) | Manifest + service worker + Web Push (VAPID) | Funziona bene su Android; su iOS Apple richiede che l'utente aggiunga prima l'app alla home (limite di Apple, non dello stack -- va detto chiaramente, non nascosto) |
| Pagamenti/abbonamenti/feature gating (p.7, 24) | Stripe Checkout + Billing + webhook -> Edge Function | Self-service reale, nessuna attivazione manuale, standard di mercato |
| Sicurezza: RLS, isolamento, rate limit, prompt injection (p.29) | RLS + service_role solo server-side + rate limit applicativo (stesso pattern già scritto e testato nel progetto precedente) + "AI non esegue, propone" come difesa strutturale | Il rischio "l'AI fa qualcosa di pericoloso" è già disinnescato dall'architettura tool-calling: ogni azione passa da una funzione con le sue regole, l'AI non ha mai accesso diretto al database |
| Test sistematici sugli scenari (p.30) | Vitest (unità/booking engine) + Playwright (end-to-end, flussi reali nel browser) | Standard per Next.js, permette di automatizzare esattamente i 15 scenari richiesti come test ripetibili, non verifiche manuali una tantum |

## Le uniche due eccezioni reali (non dello stack -- di terzi)

1. **WhatsApp per-salone in automatico**: dipende da Meta (Embedded Signup + business
   verification), non dal nostro stack -- già trattato in `verifica-stack-automazione.md`.
   Soluzione decisa: chat web + Telegram di default, WhatsApp come upgrade quando pronto.
2. **Push notification iOS**: limite di Apple su Safari/PWA (serve l'installazione manuale
   dell'utente finale alla home, non automatizzabile da noi). Non blocca nulla, va solo saputo.

Nessun'altra parte dei 33 punti ha un vincolo esterno paragonabile: tutto il resto dipende
solo da quanto codice scriviamo, non da un limite tecnico dello stack.

## Cosa cambia in pratica rispetto al piano già scritto
Aggiunte esplicite allo stack in `PIANO.md`/README (nessun cambio di base, solo le librerie
giuste per ogni pezzo): Supabase Realtime, Supabase Storage, pg_cron/pg_net, Tremor,
shadcn/ui, Vitest + Playwright. Le installo man mano che servono nella fase corrispondente
(non tutte subito, per non appesantire il progetto con dipendenze inutilizzate).
