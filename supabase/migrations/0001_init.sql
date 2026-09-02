-- Schema iniziale multi-tenant per il SaaS saloni/centri estetici.
-- Un tenant = un salone. Ogni tabella "di dominio" ha tenant_id e RLS
-- attiva: un salone non deve MAI poter leggere/scrivere righe di un altro.
--
-- Pattern RLS: una funzione helper legge il tenant_id dell'utente loggato
-- da "profiles" (popolata alla creazione dell'account/onboarding), poi ogni
-- policy confronta tenant_id della riga con quello dell'utente. Il service
-- role (usato dal backend per webhook Stripe/WhatsApp, mai esposto al
-- browser) bypassa RLS by design in Supabase -- e' li' che passano le
-- scritture "di sistema" (es. l'AI che crea una prenotazione).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tenants (saloni)
-- ---------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- per la pagina pubblica /s/<slug>
  nome text not null,
  descrizione text,
  indirizzo text,
  telefono text,
  email text,
  sito_web text,
  social jsonb default '{}'::jsonb,
  logo_url text,
  cover_url text,
  piano text not null default 'free',        -- free | starter | growth | pro | enterprise
  stato_abbonamento text not null default 'trialing', -- trialing | attivo | scaduto | cancellato
  stripe_customer_id text,
  stripe_subscription_id text,
  whatsapp_phone_number_id text,             -- collegato in un secondo momento (fase WhatsApp)
  created_at timestamptz not null default now()
);

-- Profili utente: un utente Supabase Auth = una persona, collegata a UN
-- tenant (il titolare o un suo staff). Popolata subito dopo la
-- registrazione (fa parte del flusso di onboarding automatico).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  ruolo text not null default 'owner',       -- owner | staff | admin_piattaforma
  nome text,
  telefono text,
  created_at timestamptz not null default now()
);

-- Funzione helper: tenant dell'utente loggato (usata in tutte le policy sotto).
create or replace function auth_tenant_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Orari di apertura (per giorno della settimana, 0=domenica..6=sabato)
-- ---------------------------------------------------------------------
create table orari_apertura (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  giorno_settimana int not null check (giorno_settimana between 0 and 6),
  chiuso boolean not null default false,
  apertura time,
  chiusura time,
  pausa_inizio time,
  pausa_fine time,
  unique (tenant_id, giorno_settimana)
);

-- ---------------------------------------------------------------------
-- Operatori
-- ---------------------------------------------------------------------
create table operatori (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  foto_url text,
  ruolo text,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Servizi
-- ---------------------------------------------------------------------
create table servizi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  descrizione text,
  categoria text,
  durata_minuti int not null check (durata_minuti > 0),
  prezzo_centesimi int not null check (prezzo_centesimi >= 0),
  immagine_url text,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Quali operatori possono erogare quale servizio (molti-a-molti).
create table operatori_servizi (
  operatore_id uuid not null references operatori (id) on delete cascade,
  servizio_id uuid not null references servizi (id) on delete cascade,
  primary key (operatore_id, servizio_id)
);

-- ---------------------------------------------------------------------
-- Clienti (i clienti DEL salone, non gli utenti della piattaforma)
-- ---------------------------------------------------------------------
create table clienti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text,
  telefono text,                              -- chiave di riconoscimento su WhatsApp
  email text,
  note text,
  tag text[] default '{}',
  creato_da_ai boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, telefono)
);

-- ---------------------------------------------------------------------
-- Appuntamenti -- la "single source of truth" del calendario (punto 14).
-- Sia l'AI via WhatsApp sia il titolare da dashboard scrivono QUI, mai
-- in due posti diversi.
-- ---------------------------------------------------------------------
create table appuntamenti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  cliente_id uuid references clienti (id) on delete set null,
  operatore_id uuid references operatori (id) on delete set null,
  servizio_id uuid references servizi (id) on delete set null,
  inizio timestamptz not null,
  fine timestamptz not null,
  stato text not null default 'confermato',   -- confermato | cancellato | completato | no_show
  creato_da text not null default 'manuale',  -- manuale | ai
  note text,
  created_at timestamptz not null default now(),
  check (fine > inizio)
);
-- Niente due appuntamenti sovrapposti per lo stesso operatore (a livello
-- di database, non solo di logica applicativa -- e' la difesa vera contro
-- la doppia prenotazione in concorrenza, punto 12).
create extension if not exists btree_gist;
alter table appuntamenti add constraint niente_sovrapposizioni
  exclude using gist (
    operatore_id with =,
    tstzrange(inizio, fine) with &&
  ) where (stato = 'confermato');

-- ---------------------------------------------------------------------
-- Conversazioni AI (WhatsApp) e messaggi -- contesto persistente (punto 11)
-- ---------------------------------------------------------------------
create table conversazioni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  cliente_id uuid references clienti (id) on delete set null,
  canale text not null default 'whatsapp',
  stato text not null default 'aperta',       -- aperta | chiusa | passata_a_operatore
  slot_in_costruzione jsonb default '{}'::jsonb, -- servizio/data/ora raccolti finora, non ancora confermati
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table messaggi (
  id uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references conversazioni (id) on delete cascade,
  ruolo text not null,                        -- cliente | assistente | operatore | sistema
  contenuto text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Automazioni (punto 16)
-- ---------------------------------------------------------------------
create table automazioni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tipo text not null,                         -- reminder_24h | followup_2h | inattivo_30gg | no_show | compleanno
  attiva boolean not null default true,
  config jsonb default '{}'::jsonb
);

-- ---------------------------------------------------------------------
-- Row Level Security -- isolamento tenant reale, non solo applicativo.
-- ---------------------------------------------------------------------
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table orari_apertura enable row level security;
alter table operatori enable row level security;
alter table servizi enable row level security;
alter table operatori_servizi enable row level security;
alter table clienti enable row level security;
alter table appuntamenti enable row level security;
alter table conversazioni enable row level security;
alter table messaggi enable row level security;
alter table automazioni enable row level security;

-- Un utente vede/modifica solo il PROPRIO tenant.
create policy tenant_isolato on tenants for select using (id = auth_tenant_id());
create policy tenant_update on tenants for update using (id = auth_tenant_id());

create policy solo_mio_profilo on profiles for select using (tenant_id = auth_tenant_id());

create policy isolamento_tabella on orari_apertura for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on operatori for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on servizi for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on clienti for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on appuntamenti for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on conversazioni for all using (tenant_id = auth_tenant_id());
create policy isolamento_tabella on automazioni for all using (tenant_id = auth_tenant_id());

-- I messaggi non hanno tenant_id diretto: passano dalla conversazione.
create policy isolamento_messaggi on messaggi for all using (
  conversazione_id in (select id from conversazioni where tenant_id = auth_tenant_id())
);

-- operatori_servizi: isolato tramite l'operatore collegato.
create policy isolamento_op_servizi on operatori_servizi for all using (
  operatore_id in (select id from operatori where tenant_id = auth_tenant_id())
);

-- NOTA: le scritture dell'AI (dal webhook WhatsApp) e i webhook Stripe
-- passano dal service_role key del backend, che bypassa RLS by design in
-- Supabase -- e' per questo che quelle chiamate vivono in codice server-side
-- attendibile (Edge Function), MAI nel browser del cliente finale.
