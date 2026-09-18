-- 0068: quanto costa davvero far parlare l'assistente.
--
-- PERCHE' ESISTE. Il 19/09/2026 Gabriel ha chiesto se i tetti AI dei piani
-- lasciano abbastanza margine. Per rispondere ho rifatto il conto e ho
-- scoperto che il conto precedente (DECISIONS.md, 02/09) era ottimistico di
-- circa due volte e mezzo. Ma anche il mio e' una stima: prompt di sistema
-- misurato a occhio, numero medio di chiamate per messaggio ipotizzato,
-- comportamento della cache dedotto. Due stime che non vanno d'accordo non
-- fanno un numero.
--
-- L'API Anthropic restituisce `usage` su OGNI risposta. Non lo leggeva
-- nessuno. Questa tabella lo legge.
--
-- UNA RIGA PER CHIAMATA AL MODELLO, non per conversazione: una conversazione
-- ne fa piu' d'una (una per chiamare uno strumento, una per rispondere) e
-- sono proprio quelle chiamate intermedie che il conto a mano sottostimava.
-- Aggregare si puo' sempre dopo; disaggregare un dato mai raccolto, no.
--
-- COSA NON C'E' DENTRO, di proposito: niente testo, niente messaggi, niente
-- numeri di telefono. Solo conteggi. E' un registro di costi, non una copia
-- delle conversazioni dei clienti: se un giorno qualcuno leggera' queste
-- righe per capire i margini, non deve trovarci dentro quello che una persona
-- ha scritto in chat.

create table if not exists usi_api_ai (
  id uuid primary key default gen_random_uuid(),

  -- Nullable, e non e' una svista: la demo pubblica della landing chiama lo
  -- stesso modello senza appartenere a nessun salone. Quel costo esiste,
  -- viene pagato, e va contato -- altrimenti il totale della bolletta non
  -- torna mai con la somma delle righe. `on delete cascade` perche' un
  -- salone cancellato non deve lasciare righe orfane con il suo id.
  tenant_id uuid references tenants(id) on delete cascade,

  canale text not null,
  modello text not null,
  -- Il nome del listino con cui e' stato calcolato `costo_microdollari`
  -- (es. 'haiku-4.5@2026-09-19'). Senza questo, fra sei mesi non si puo'
  -- sapere se una riga vecchia e' stata calcolata coi prezzi di allora o con
  -- quelli di adesso.
  listino text not null,

  -- I token grezzi: questi non invecchiano mai. Se domani i prezzi cambiano,
  -- da qui si puo' rifare qualunque conto.
  token_input integer not null default 0,
  token_output integer not null default 0,
  token_scrittura_cache integer not null default 0,
  token_lettura_cache integer not null default 0,

  -- Il costo congelato al momento della chiamata, in MILIONESIMI di dollaro.
  -- Intero apposta: sommare centomila numeri in virgola mobile accumula un
  -- errore che ci si accorge di avere solo quando bisogna difendere una
  -- cifra.
  costo_microdollari integer not null default 0,

  creato_il timestamptz not null default now()
);

-- La domanda vera e' sempre "quanto ha speso QUESTO salone in QUESTO mese":
-- l'indice serve quella, nell'ordine in cui la si fa.
create index if not exists idx_usi_api_ai_tenant_data on usi_api_ai (tenant_id, creato_il desc);
-- E quella trasversale, "quanto e' costato ogni canale questo mese", che
-- serve a capire se a pesare e' la chat dei clienti o la demo della landing.
create index if not exists idx_usi_api_ai_data on usi_api_ai (creato_il desc);

alter table usi_api_ai enable row level security;

-- NESSUNA POLICY, ed e' deliberato: sono dati di costo interni, non dati del
-- salone. Nessun titolare deve poterli leggere -- non perche' siano segreti,
-- ma perche' non sono suoi: raccontano i margini di Salone AI, non l'attivita'
-- del cliente. Con RLS attiva e zero policy, `authenticated` e `anon` non
-- vedono niente anche se qualcuno domani concedesse loro una SELECT per
-- sbaglio.
revoke select, insert, update, delete on usi_api_ai from authenticated;
revoke select, insert, update, delete on usi_api_ai from anon;

-- L'unico che scrive e' il server, con la service_role, da
-- src/lib/ai/costi.server.ts.
