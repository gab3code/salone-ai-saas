-- Promemoria automatici (Fase 6, trovato nel controllo promesse del sito
-- 13/09/2026, costruito il 14/09/2026, RISCRITTA lo stesso giorno prima di
-- essere applicata al database reale -- vedi PROJECT_STATUS.md): Gabriel ha
-- chiesto che lo staff possa decidere QUANTO tempo prima mandare il
-- promemoria e se averne più di uno. La prima versione (colonna singola
-- `appuntamenti.promemoria_inviato_at`, mai applicata) non lo permetteva --
-- sostituita qui da una tabella di regole per-tenant configurabili da
-- dashboard, prima che la vecchia forma toccasse mai il database vero.
--
-- `Funzionalita.tsx` promette due cose sotto "Promemoria automatici":
-- "Reminder prima dell'appuntamento" (qui, configurabile) e "follow-up ai
-- clienti inattivi" (invariato, ancora una singola colonna su `clienti` --
-- lì "quanto tempo prima" non ha senso, è "quanto tempo di inattività",
-- un asse diverso che Gabriel non ha chiesto di rendere configurabile).

-- Una riga per ogni "quando avvisare" che un tenant vuole attivo (es. 72 ore
-- E 24 ore prima -- due righe, due promemoria per lo stesso appuntamento).
-- `unique` sul tenant+ore evita due regole identiche per errore da
-- dashboard.
create table regole_promemoria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  ore_preavviso integer not null check (ore_preavviso > 0 and ore_preavviso <= 720), -- max 30 giorni, oltre non ha senso
  created_at timestamptz not null default now(),
  unique (tenant_id, ore_preavviso)
);

alter table regole_promemoria enable row level security;

-- Stesso livello di fiducia di lista_attesa: lo staff crea/rimuove le
-- proprie regole direttamente da dashboard, nessun controllo che tocchi
-- soldi reali qui dentro.
create policy isolamento_tabella on regole_promemoria for all using (tenant_id = auth_tenant_id());

grant select, insert, update, delete on public.regole_promemoria to authenticated;
grant select, insert, update, delete on public.regole_promemoria to service_role;

-- Un appuntamento può ricevere più promemoria (una riga per regola che è
-- effettivamente scattata) -- sostituisce la singola colonna
-- `promemoria_inviato_at` della versione precedente, che poteva tracciare un
-- solo invio per appuntamento e quindi non reggeva più regole.
create table promemoria_appuntamento_inviati (
  id uuid primary key default gen_random_uuid(),
  appuntamento_id uuid not null references appuntamenti (id) on delete cascade,
  regola_id uuid not null references regole_promemoria (id) on delete cascade,
  inviato_at timestamptz not null default now(),
  unique (appuntamento_id, regola_id)
);
create index promemoria_appuntamento_inviati_appuntamento_idx on promemoria_appuntamento_inviati (appuntamento_id);

alter table promemoria_appuntamento_inviati enable row level security;

-- Stesso pattern di richieste_caparra: sola lettura per lo staff (potrà
-- servire in futuro per mostrare "già avvisato" in dashboard), scritture
-- solo dal job schedulato (service_role) -- un titolare non deve poter
-- segnare a mano un invio come già fatto.
create policy isolamento_tabella on promemoria_appuntamento_inviati for select using (
  appuntamento_id in (select id from appuntamenti where tenant_id = auth_tenant_id())
);

grant select on public.promemoria_appuntamento_inviati to authenticated;
grant select, insert, update, delete on public.promemoria_appuntamento_inviati to service_role;

-- Follow-up ai clienti inattivi (l'altra metà della promessa, invariato
-- rispetto alla versione precedente di questa migrazione): una singola
-- colonna basta, "quanto tempo prima" non si applica qui.
alter table clienti add column promemoria_inattivita_inviato_at timestamptz;

-- Default 24 ore per OGNI tenant già esistente: chi non tocca mai le nuove
-- impostazioni mantiene esattamente il comportamento già raccontato in
-- PIANO.md prima di questa richiesta (un preavviso di circa un giorno),
-- zero configurazione richiesta per continuare a funzionare come prima.
insert into regole_promemoria (tenant_id, ore_preavviso)
select id, 24 from tenants;

-- Stessa riga di default anche per ogni NUOVO tenant che si registra da qui
-- in avanti -- altrimenti un salone che si iscrive oggi partirebbe senza
-- nessun promemoria attivo finché qualcuno non visita le impostazioni,
-- un comportamento silenzioso e diverso da quello di ogni tenant esistente.
create or replace function public.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nuovo_tenant_id uuid;
  nome_salone text;
begin
  nome_salone := coalesce(nullif(trim(new.raw_user_meta_data->>'nome_salone'), ''), 'Il mio salone');

  insert into tenants (slug, nome)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    nome_salone
  )
  returning id into nuovo_tenant_id;

  insert into profiles (id, tenant_id, ruolo, nome)
  values (new.id, nuovo_tenant_id, 'owner', nullif(trim(new.raw_user_meta_data->>'nome_persona'), ''));

  insert into orari_apertura (tenant_id, giorno_settimana, chiuso)
  select nuovo_tenant_id, giorno, true
  from generate_series(0, 6) as giorno;

  insert into regole_promemoria (tenant_id, ore_preavviso)
  values (nuovo_tenant_id, 24);

  return new;
end;
$$;
