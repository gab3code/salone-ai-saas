-- Preparazione per il collegamento WhatsApp self-service via Meta Embedded
-- Signup (punto 18 della spec). Non ancora utilizzabile: richiede un'app Meta
-- di tipo Business, business verification e App Review lato nostro (piattaforma),
-- non per singolo cliente -- vedi docs/embedded-signup-whatsapp.md per il
-- percorso completo e cosa serve da Gabriel prima di attivarlo.
--
-- Schema pronto FIN DA ORA cosi' il giorno che l'app Meta e' approvata basta
-- collegare le chiavi, senza dover riprogettare le tabelle.

-- Stato del collegamento WhatsApp di un tenant (in aggiunta a
-- whatsapp_phone_number_id gia' presente su "tenants" dalla migrazione 0001).
alter table tenants
  add column whatsapp_business_id text,             -- business portfolio id restituito da Embedded Signup
  add column whatsapp_waba_id text,                  -- WhatsApp Business Account id
  add column whatsapp_stato text not null default 'non_collegato';
  -- whatsapp_stato: non_collegato | in_corso | collegato | errore | revocato

-- Le credenziali vere e proprie (token) NON vivono nella stessa tabella dei
-- dati del tenant, per due motivi: (1) un token WhatsApp e' un segreto quanto
-- una password, non deve mai poter essere letto da RLS pensata per "il
-- titolare vede i propri dati"; (2) separare le rotazioni/scadenze dei token
-- dal resto dell'anagrafica del salone.
create table whatsapp_credenziali (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  access_token text not null,           -- token lungo termine del business, MAI esposto al client
  token_scade_il timestamptz,
  ultimo_aggiornamento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- RLS attiva ma SENZA alcuna policy: significa accesso negato a chiunque usi
-- la anon key o un utente autenticato, qualsiasi sia il suo ruolo -- solo il
-- service_role (usato esclusivamente dal backend/Edge Function, mai dal
-- browser) puo' leggere o scrivere qui, perche' bypassa RLS by design in
-- Supabase. E' il pattern corretto per un segreto per-tenant: non un "quasi
-- tutti i dati del salone", un vero e proprio segreto.
alter table whatsapp_credenziali enable row level security;

-- Log dei tentativi di collegamento (utile sia per debug sia per l'admin
-- panel: "questo salone ha provato a collegare WhatsApp e ha fallito perche'...").
create table whatsapp_collegamento_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  evento text not null,                 -- avviato | code_ricevuto | token_scambiato | webhook_sottoscritto | sync_avviata | errore
  dettaglio jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table whatsapp_collegamento_log enable row level security;
create policy isolamento_tabella on whatsapp_collegamento_log for select using (tenant_id = auth_tenant_id());
-- Solo lettura per il titolare (per mostrare "cosa e' successo" in dashboard);
-- le scritture arrivano solo dal service_role durante il flusso di collegamento.
