-- Fase 3, Raccolta recensioni post-appuntamento (deciso con Gabriel il
-- 16/09/2026 -- vedi DECISIONS.md per il percorso completo delle decisioni
-- di scope). Un cliente che ha DAVVERO avuto un appuntamento riceve
-- un'email 2 ore dopo la fine del servizio (QStash, vedi
-- src/lib/recensioni.server.ts e src/app/api/webhooks/qstash/richiedi-recensione/route.ts)
-- con un link per lasciare una valutazione 1-5 stelle + un commento
-- facoltativo. Nessun accesso diretto senza quel link: chi non ha avuto un
-- appuntamento reale non può lasciare una recensione (stesso principio di
-- booking.com citato da Gabriel).
--
-- Decisioni esplicite di Gabriel (16/09/2026), tutte applicate qui:
-- 1. UNA recensione per appuntamento (unique su appuntamento_id) -- è anche
--    il meccanismo che rende il link monouso: una volta inserita la riga,
--    un secondo tentativo con lo stesso appuntamento_id fallisce sul
--    vincolo unique (vedi inserisciRecensione in recensioni.server.ts, che
--    lo ricontrolla anche PRIMA di scrivere per un messaggio d'errore
--    chiaro invece di un errore Postgres grezzo).
-- 2. Il titolare non può MAI modificare o cancellare una recensione (vera o
--    negativa che sia) -- può solo aggiungere una risposta pubblica sotto,
--    per contestualizzare una recensione fuorviante. Applicato non solo in
--    codice ma nei permessi Postgres: "authenticated" riceve SOLO select su
--    questa tabella, stesso identico pattern già usato per
--    richieste_caparra (dove il titolare non deve poter alterare a mano
--    l'esito di un pagamento Stripe, vedi 0011_deposito_caparra.sql) --
--    ogni scrittura (inserimento dal cliente, risposta del titolare) passa
--    da service_role via una server action dedicata, mai da una query
--    diretta del browser.
-- 3. Nessun hide/delete per singola recensione: l'unica leva di visibilità è
--    l'interruttore generale per tenant (tenants.raccolta_recensioni_attiva
--    sotto), che controlla insieme DUE cose (mai separatamente) -- l'invio
--    di nuove richieste E la visualizzazione pubblica di quelle già
--    raccolte. Le righe restano sempre intatte nel database.
create table recensioni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  appuntamento_id uuid not null unique references appuntamenti (id) on delete cascade,
  cliente_id uuid references clienti (id) on delete set null,
  valutazione smallint not null check (valutazione between 1 and 5),
  commento text,
  risposta_titolare text,
  risposta_titolare_creato_at timestamptz,
  created_at timestamptz not null default now()
);

create index recensioni_tenant_idx on recensioni (tenant_id, created_at desc);

alter table recensioni enable row level security;

create policy isolamento_tabella on recensioni for select using (tenant_id = auth_tenant_id());

grant select on public.recensioni to authenticated;
grant select, insert, update, delete on public.recensioni to service_role;

-- Interruttore generale per tenant (default ACCESO -- scelta esplicita di
-- Gabriel: le recensioni si possono già lasciare su Google, non c'è motivo
-- di partire spenti). Vedi punto 3 sopra per cosa controlla.
alter table tenants
  add column raccolta_recensioni_attiva boolean not null default true;

comment on column tenants.raccolta_recensioni_attiva is
  'Interruttore unico (mai per singola recensione): se spento, non si programma più nessuna nuova richiesta di recensione E la sezione recensioni sparisce dalla pagina pubblica. Le righe già raccolte restano intatte.';

-- Claim-before-send (stesso principio di promemoria_appuntamento_inviati in
-- 0017_promemoria_automatici.sql): il webhook QStash aggiorna questa colonna
-- da null a now() con un update condizionato PRIMA di mandare l'email, così
-- una doppia consegna dello stesso messaggio (QStash garantisce "almeno una
-- volta", mai "esattamente una volta") non manda la richiesta due volte.
-- Serve anche a rendere il controllo di legittimità al momento dell'invio
-- (non solo alla programmazione, 2 ore prima) autorevole: appuntamento non
-- cancellato nel frattempo, interruttore del tenant ancora acceso.
alter table appuntamenti
  add column recensione_richiesta_inviata_at timestamptz;
