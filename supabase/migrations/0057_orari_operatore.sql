-- 0057: orari settimanali del singolo operatore.
--
-- Fino a qui gli orari erano SOLO del salone: tutti gli operatori erano
-- disponibili in tutte le ore di apertura. Per un part-time -- Rita che
-- lavora solo di mattina -- l'unico rimedio era inserirle una chiusura
-- pomeridiana giorno per giorno, a mano, per sempre. Non e' una
-- configurazione, e' una punizione.
--
-- Nessuna riga qui dentro = l'operatore segue gli orari del salone, che e'
-- esattamente il comportamento di oggi: la tabella nasce vuota e non cambia
-- niente per nessuno finche' il titolare non scrive qualcosa.

create table if not exists orari_operatore (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operatore_id uuid not null references operatori (id) on delete cascade,
  giorno_settimana int not null check (giorno_settimana between 0 and 6),
  chiuso boolean not null default false,
  apertura time,
  chiusura time,
  pausa_inizio time,
  pausa_fine time,
  created_at timestamptz not null default now(),
  unique (operatore_id, giorno_settimana),
  -- Un giorno lavorato deve avere due estremi sensati; un giorno non
  -- lavorato non ha bisogno di niente.
  check (chiuso or (apertura is not null and chiusura is not null and chiusura > apertura)),
  -- La pausa o c'e' tutta o non c'e': mezza pausa e' un dato che il motore
  -- non saprebbe interpretare.
  check ((pausa_inizio is null) = (pausa_fine is null)),
  check (pausa_inizio is null or pausa_fine > pausa_inizio)
);

create index if not exists orari_operatore_per_tenant on orari_operatore (tenant_id);
create index if not exists orari_operatore_per_operatore on orari_operatore (operatore_id);

comment on table orari_operatore is
  'Orari settimanali del singolo operatore. Nessuna riga per un operatore = segue gli orari del salone. La disponibilita'' vera e'' sempre l''INTERSEZIONE fra i due: un operatore non puo'' lavorare quando il salone e'' chiuso.';

alter table orari_operatore enable row level security;
drop policy if exists isolamento_tabella on orari_operatore;
create policy isolamento_tabella on orari_operatore for all using (tenant_id = auth_tenant_id());

-- I permessi si scrivono qui, non si ereditano: una tabella nuova nasce con
-- i default dello schema, e i default non sono una decisione di nessuno.
-- (La 0049 ha gia' tolto insert/update/delete ai default, ma non la SELECT:
-- senza la revoca esplicita qui sotto, `anon` leggerebbe gli orari dello
-- staff di ogni salone con la sola chiave pubblica.)
revoke all on public.orari_operatore from anon;
grant select, insert, update, delete on public.orari_operatore to authenticated;
grant select, insert, update, delete on public.orari_operatore to service_role;

-- E la stessa trappola chiusa una volta per tutte, per le tabelle che
-- verranno: la 0055 ha ripulito quelle esistenti, questa impedisce alla
-- prossima di nascere gia' leggibile da `anon`.
alter default privileges in schema public revoke select on tables from anon;
