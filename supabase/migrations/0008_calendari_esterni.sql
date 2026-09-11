-- Fase 6bis (deciso con Gabriel il 02/09/2026, vedi PIANO.md/DECISIONS.md):
-- collegamento del calendario personale di ogni operatore (Google o Apple/
-- iCloud) al motore di disponibilità, nelle due direzioni: esportare gli
-- appuntamenti del salone + importare gli impegni personali come "occupato"
-- per evitare doppie prenotazioni. Il calendario del database (`appuntamenti`)
-- resta l'unica fonte di verità (punto 9) -- queste tabelle sono solo le
-- credenziali di collegamento e la mappatura verso l'evento esterno, mai un
-- secondo posto dove si decide la disponibilità.

-- ---------------------------------------------------------------------
-- Un collegamento per operatore per provider (un operatore può avere sia
-- Google sia Apple insieme, ma non due Google).
-- ---------------------------------------------------------------------
create table collegamenti_calendario_esterni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operatore_id uuid not null references operatori (id) on delete cascade,
  provider text not null check (provider in ('google', 'apple')),
  stato text not null default 'connesso',   -- connesso | errore | disconnesso
  ultimo_errore text,

  -- Google: OAuth2, refresh token per rinnovare l'access token quando scade.
  google_access_token text,
  google_refresh_token text,
  google_token_scadenza timestamptz,
  google_calendar_id text,                  -- di solito "primary", ma configurabile

  -- Apple/iCloud: CalDAV con password specifica per l'app (generata
  -- dall'operatore, non la password del suo Apple ID).
  -- NOTA sicurezza (da risolvere entro la revisione di Fase 6, punto 29):
  -- oggi in chiaro come le altre colonne token di questa tabella -- va
  -- valutato il cifraggio a riposo (es. Supabase Vault / pgsodium) prima che
  -- ci siano dati reali di clienti paganti qui dentro, non solo di test.
  caldav_url text,
  caldav_username text,
  caldav_password text,

  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (operatore_id, provider)
);

-- ---------------------------------------------------------------------
-- Mappatura appuntamento interno <-> evento sul calendario esterno, per
-- poter aggiornare/cancellare l'evento giusto quando l'appuntamento cambia
-- (necessaria solo per la direzione export, che verrà popolata quando
-- costruiamo quel verso -- oggi la tabella esiste già per non dover fare
-- un'altra migrazione quando ci arriviamo).
-- ---------------------------------------------------------------------
create table eventi_calendario_esterni (
  id uuid primary key default gen_random_uuid(),
  collegamento_id uuid not null references collegamenti_calendario_esterni (id) on delete cascade,
  appuntamento_id uuid not null references appuntamenti (id) on delete cascade,
  id_evento_esterno text not null,
  creato_il timestamptz not null default now(),
  unique (collegamento_id, appuntamento_id)
);

alter table collegamenti_calendario_esterni enable row level security;
alter table eventi_calendario_esterni enable row level security;

create policy isolamento_tabella on collegamenti_calendario_esterni for all using (tenant_id = auth_tenant_id());

-- eventi_calendario_esterni non ha tenant_id diretto: isolato tramite il
-- collegamento (stesso pattern già usato per "messaggi" via conversazioni).
create policy isolamento_eventi_esterni on eventi_calendario_esterni for all using (
  collegamento_id in (select id from collegamenti_calendario_esterni where tenant_id = auth_tenant_id())
);

-- Grant esplicito per service_role, anche se 0007 ha già impostato i default
-- privileges per le tabelle future -- quei default valgono solo per le
-- prossime CREATE TABLE fatte dallo STESSO ruolo che ha eseguito 0007. Se
-- questa migrazione viene eseguita da un ruolo diverso (es. un altro utente
-- del progetto Supabase), i default privileges non si applicano e si
-- ripresenterebbe lo stesso bug di "permission denied" già risolto in 0007 --
-- meglio essere espliciti qui piuttosto che scoprirlo di nuovo da un errore
-- live in produzione.
grant select, insert, update, delete on public.collegamenti_calendario_esterni to service_role;
grant select, insert, update, delete on public.eventi_calendario_esterni to service_role;
