-- Chiusure straordinarie (ferie, festivita', assenza di un operatore) -- punto 13.
-- Non sono ricorrenti come orari_apertura: sono eccezioni su una data precisa.
-- operatore_id NULL = chiusura di tutto il salone (es. Natale); valorizzato = ferie
-- di un singolo operatore (gli altri restano prenotabili).

create table chiusure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operatore_id uuid references operatori (id) on delete cascade,
  data date not null,
  giorno_intero boolean not null default true,
  ora_inizio time,                      -- usato solo se giorno_intero = false
  ora_fine time,                        -- usato solo se giorno_intero = false
  motivo text,
  created_at timestamptz not null default now(),
  check (giorno_intero or (ora_inizio is not null and ora_fine is not null and ora_fine > ora_inizio))
);

alter table chiusure enable row level security;
create policy isolamento_tabella on chiusure for all using (tenant_id = auth_tenant_id());

create index chiusure_tenant_data_idx on chiusure (tenant_id, data);
