-- Fase 5 -- Più attività per un solo account, e ruoli veri (owner/staff).
--
-- Due promesse del sito che finora non avevano NESSUN supporto nello schema:
-- "Multi-sede" e "ruoli avanzati" su Enterprise (vedi Prezzi.tsx e il task
-- corrispondente in PIANO.md). Decisione presa con Gabriel il 16/09/2026:
-- una catena con più negozi NON diventa un tenant con dentro tante "sedi",
-- ma resta più tenant separati collegati a un unico account che ci passa in
-- mezzo con un selettore.
--
-- Perché questa strada e non una tabella `sedi` con `sede_id` sparso su
-- orari/operatori/servizi/appuntamenti:
--   1) `auth_tenant_id()` (migrazione 0001) è il perno di OGNI policy RLS del
--      progetto. Restando "un tenant = un luogo", quella funzione e tutte le
--      policy esistenti non vengono toccate: zero rischio di aprire un buco
--      di isolamento sui dati già in produzione.
--   2) Il booking engine, la pagina pubblica e l'agente AI continuano a
--      ragionare su un solo luogo per volta, che è esattamente come lavorano
--      davvero due negozi della stessa catena (orari propri, personale
--      proprio, numero di telefono proprio).
--   3) Ogni sede mantiene la SUA pagina pubblica `/s/[slug]` con il suo
--      indirizzo: due pagine indicizzabili su Google invece di una sola con
--      un menu a tendina.
-- Limite dichiarato e accettato: niente report aggregati fra sedi e niente
-- rubrica clienti condivisa. Si aggiungono sopra questa stessa struttura il
-- giorno in cui un cliente vero li chiede, non prima.
--
-- `profiles.tenant_id` NON cambia significato per il database: resta "il
-- tenant di questo utente", ed è quello che RLS continua a leggere. Cambia
-- solo per l'applicazione, dove diventa "la sede attiva in questo momento":
-- cambiare sede = aggiornare quella colonna dopo aver verificato che
-- l'utente sia davvero membro della sede di destinazione.

-- ---------------------------------------------------------------------
-- Appartenenze: chi può entrare in quale attività, e con quale ruolo.
-- ---------------------------------------------------------------------
create table membri_tenant (
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  -- owner: accesso pieno. staff: agenda, clienti e lista d'attesa, ma NIENTE
  -- fatturato/analytics, NIENTE configurazione (servizi, prezzi, orari) e
  -- NIENTE abbonamento/fatturazione -- scelta di Gabriel del 16/09/2026.
  -- `admin_piattaforma` NON compare qui: è un ruolo di PIATTAFORMA (Gabriel),
  -- non di un'attività, e resta dov'è sempre stato, su `profiles.ruolo`.
  ruolo text not null default 'staff' check (ruolo in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create index membri_tenant_tenant_idx on membri_tenant (tenant_id);

-- Backfill: ogni profilo che esiste oggi è già membro del proprio tenant.
-- `admin_piattaforma` viene normalizzato a 'owner' QUI dentro (è owner della
-- propria attività come chiunque altro); il suo potere di piattaforma resta
-- scritto su profiles.ruolo e non viene toccato.
insert into membri_tenant (user_id, tenant_id, ruolo)
select id, tenant_id, case when ruolo = 'staff' then 'staff' else 'owner' end
from profiles
where tenant_id is not null
on conflict (user_id, tenant_id) do nothing;

-- Un account può restare SENZA nessuna attività: succede quando un titolare
-- rimuove un dipendente che non fa parte di nient'altro. Senza questo, quel
-- dipendente resterebbe per sempre collegato all'attività da cui è stato
-- tolto -- cioè la rimozione non rimuoverebbe niente.
-- Effetto su RLS: `auth_tenant_id()` restituisce null e ogni policy del
-- progetto confronta `tenant_id = null`, che in SQL non è mai vero. Quindi
-- un account senza attività non legge e non scrive nulla, di default, senza
-- dover toccare una sola policy esistente.
alter table profiles alter column tenant_id drop not null;

-- ---------------------------------------------------------------------
-- Inviti: come un secondo account entra in un'attività esistente.
-- ---------------------------------------------------------------------
-- Volutamente NON passiamo dai metadata di `auth.signUp`: quelli li sceglie
-- il browser di chi si registra, quindi chiunque potrebbe registrarsi
-- dichiarando "sono staff del tenant X" e ritrovarsi dentro l'attività di un
-- altro. Una riga di invito, invece, può nascere solo da una server action
-- eseguita da un owner di quel tenant, ed è legata all'EMAIL: Supabase
-- verifica l'email, quindi l'invito lo può consumare solo chi la possiede.
create table inviti_membro (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  email text not null,
  ruolo text not null default 'staff' check (ruolo in ('owner', 'staff')),
  creato_da uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  scade_il timestamptz not null default now() + interval '14 days',
  usato_il timestamptz
);

-- Un solo invito pendente per (attività, email): un secondo invito alla
-- stessa persona aggiorna quello esistente invece di accumularne due.
create unique index inviti_membro_pendente_idx
  on inviti_membro (tenant_id, lower(email))
  where usato_il is null;

-- Cercato per email dal trigger di registrazione e dalla pagina degli inviti
-- in sospeso: indicizzato sulla stessa espressione usata nella query.
create index inviti_membro_email_idx
  on inviti_membro (lower(email))
  where usato_il is null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table membri_tenant enable row level security;
alter table inviti_membro enable row level security;

-- Un utente vede le proprie appartenenze: è quello che alimenta il selettore
-- di sede, che deve funzionare PRIMA di sapere quale sede è attiva (quindi
-- non può passare da auth_tenant_id()).
create policy membri_propri on membri_tenant
  for select using (user_id = auth.uid());

-- ...e vede i colleghi della sede attiva, per la schermata "Team".
create policy membri_della_sede_attiva on membri_tenant
  for select using (tenant_id = auth_tenant_id());

-- Gli inviti dell'attività attiva sono visibili a chi ci lavora; la UI li
-- mostra comunque solo all'owner, ma è giusto che non siano leggibili da
-- un'altra attività.
create policy inviti_della_sede_attiva on inviti_membro
  for select using (tenant_id = auth_tenant_id());

-- NESSUNA policy di insert/update/delete su queste due tabelle, di
-- proposito: ogni scrittura passa dal service_role in una server action che
-- ha prima verificato il ruolo di chi la chiede (src/lib/membri.server.ts).
-- Un client autenticato non può aggiungersi a un'attività né promuoversi da
-- staff a owner nemmeno chiamando direttamente le API REST di Supabase.

grant select on public.membri_tenant to authenticated;
grant select, insert, update, delete on public.membri_tenant to service_role;
grant select on public.inviti_membro to authenticated;
grant select, insert, update, delete on public.inviti_membro to service_role;

-- ---------------------------------------------------------------------
-- Provisioning alla registrazione
-- ---------------------------------------------------------------------
-- Rispetto alla versione della migrazione 0017 cambia una cosa sola: prima
-- di creare una nuova attività, si controlla se per quell'email esiste un
-- invito valido. Se c'è, l'utente ENTRA nell'attività che lo ha invitato e
-- non se ne crea una sua -- altrimenti ogni dipendente invitato si
-- ritroverebbe un salone fantasma vuoto collegato al proprio account.
create or replace function public.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nuovo_tenant_id uuid;
  nome_salone text;
  invito inviti_membro%rowtype;
begin
  select *
  into invito
  from inviti_membro
  where usato_il is null
    and scade_il > now()
    and lower(email) = lower(coalesce(new.email, ''))
  order by created_at desc
  limit 1;

  if found then
    insert into profiles (id, tenant_id, ruolo, nome)
    values (
      new.id,
      invito.tenant_id,
      invito.ruolo,
      nullif(trim(new.raw_user_meta_data->>'nome_persona'), '')
    );

    insert into membri_tenant (user_id, tenant_id, ruolo)
    values (new.id, invito.tenant_id, invito.ruolo)
    on conflict (user_id, tenant_id) do update set ruolo = excluded.ruolo;

    update inviti_membro set usato_il = now() where id = invito.id;

    return new;
  end if;

  nome_salone := coalesce(nullif(trim(new.raw_user_meta_data->>'nome_salone'), ''), 'Il mio salone');

  insert into tenants (slug, nome)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    nome_salone
  )
  returning id into nuovo_tenant_id;

  insert into profiles (id, tenant_id, ruolo, nome)
  values (new.id, nuovo_tenant_id, 'owner', nullif(trim(new.raw_user_meta_data->>'nome_persona'), ''));

  -- Nuovo rispetto alla 0017: chi crea un'attività ne è owner anche nella
  -- tabella delle appartenenze, altrimenti il selettore di sede non la
  -- vedrebbe mai.
  insert into membri_tenant (user_id, tenant_id, ruolo)
  values (new.id, nuovo_tenant_id, 'owner')
  on conflict (user_id, tenant_id) do nothing;

  insert into orari_apertura (tenant_id, giorno_settimana, chiuso)
  select nuovo_tenant_id, giorno, true
  from generate_series(0, 6) as giorno;

  insert into regole_promemoria (tenant_id, ore_preavviso)
  values (nuovo_tenant_id, 24);

  return new;
end;
$$;
