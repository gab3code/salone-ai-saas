-- 0059: anche l'AI usata DALLA DASHBOARD consuma la quota del salone.
--
-- Fino a qui il contatore mensile era un conteggio derivato: i messaggi dei
-- CLIENTI, contati a runtime su `messaggi`. Tutto quello che il salone faceva
-- fare al modello dalla propria dashboard non compariva da nessuna parte:
--
--   * la bozza di configurazione dell'onboarding AI non aveva ne' contatore
--     ne' tetto ne' gate di piano -- era l'unica strada del prodotto che
--     chiamava Anthropic senza che niente la registrasse o la fermasse;
--   * la prova dell'assistente aveva un tetto suo (`tenants.demo_ai_usate`,
--     migrazione 0041) che pero' non entrava nella quota mensile.
--
-- Richiesta di Gabriel il 18/09/2026: "il contatore del limite di messaggi
-- deve salire anche quando il salone usa l'ai all'interno della dashboard".
--
-- Il conteggio resta derivato -- niente colonna contatore da tenere
-- allineata a mano -- ma ora somma due sorgenti: i messaggi dei clienti e le
-- righe di questa tabella.

create table if not exists usi_ai_interni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tipo text not null check (tipo in ('onboarding', 'prova_assistente')),
  created_at timestamptz not null default now()
);

create index if not exists usi_ai_interni_per_tenant_e_data
  on usi_ai_interni (tenant_id, created_at desc);

comment on table usi_ai_interni is
  'Una riga per ogni chiamata al modello fatta dal salone dalla propria dashboard (bozza di onboarding, prova assistente). Sommata ai messaggi dei clienti, forma la quota mensile del tenant.';

alter table usi_ai_interni enable row level security;
drop policy if exists lettura_tenant on usi_ai_interni;
-- Il titolare puo' vedere quante volte ha usato l'AI: e' il numero che gli
-- mostriamo in dashboard. Scrivere no: passa dalla funzione qui sotto.
create policy lettura_tenant on usi_ai_interni
  for select using (tenant_id = auth_tenant_id());

revoke all on public.usi_ai_interni from anon;
grant select on public.usi_ai_interni to authenticated;
grant select, insert, delete on public.usi_ai_interni to service_role;

-- Controlla e consuma NELLA STESSA istruzione: due schede aperte insieme non
-- devono poter passare lo stesso ultimo uso disponibile. Stesso principio di
-- `consuma_demo_ai` (0041), e come quella e' eseguibile solo dal
-- service_role: se potesse chiamarla il titolare, si passerebbe da solo il
-- limite che preferisce come terzo parametro.
create or replace function consuma_uso_ai_interno(
  p_tenant_id uuid,
  p_tipo text,
  p_limite integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inizio_mese timestamptz := date_trunc('month', (now() at time zone 'utc'));
  v_usati integer;
begin
  select
    (select count(*) from usi_ai_interni u
      where u.tenant_id = p_tenant_id and u.created_at >= v_inizio_mese)
    +
    (select count(*) from messaggi m
       join conversazioni c on c.id = m.conversazione_id
      where c.tenant_id = p_tenant_id
        and m.ruolo = 'cliente'
        and m.created_at >= v_inizio_mese)
  into v_usati;

  if v_usati >= p_limite then
    return -1;
  end if;

  insert into usi_ai_interni (tenant_id, tipo) values (p_tenant_id, p_tipo);
  return p_limite - v_usati - 1;
end;
$$;

comment on function consuma_uso_ai_interno(uuid, text, integer) is
  'Controlla la quota mensile (messaggi dei clienti + usi interni) e ne consuma uno, atomicamente. Restituisce quanti ne restano, oppure -1 se il tetto era gia'' raggiunto.';

revoke all on function consuma_uso_ai_interno(uuid, text, integer) from public;
revoke all on function consuma_uso_ai_interno(uuid, text, integer) from anon;
revoke all on function consuma_uso_ai_interno(uuid, text, integer) from authenticated;
grant execute on function consuma_uso_ai_interno(uuid, text, integer) to service_role;
