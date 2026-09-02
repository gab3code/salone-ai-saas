-- Provisioning automatico (punto 5/8 della spec): alla registrazione di un
-- nuovo utente Supabase Auth, viene creato IN AUTOMATICO un tenant (il
-- salone) e il profilo owner collegato -- zero intervento manuale, questo è
-- il primo passo del funnel "registrazione -> operativo" senza Gabriel.
--
-- Il nome del salone, se il form di registrazione lo passa come metadata
-- (options.data.nome_salone nella chiamata supabase.auth.signUp), viene letto
-- da qui; altrimenti si usa un placeholder che l'utente cambia nell'onboarding.
--
-- Vengono create anche 7 righe in orari_apertura (una per giorno), tutte
-- chiuse di default: il salone non deve mai sembrare "aperto 24/7" prima che
-- il titolare configuri davvero gli orari nell'onboarding.

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

  return new;
end;
$$;

-- DROP + CREATE (non "or replace") perché i trigger non supportano la
-- sostituzione diretta della definizione in Postgres.
drop trigger if exists al_nuovo_utente on auth.users;
create trigger al_nuovo_utente
  after insert on auth.users
  for each row execute function public.gestisci_nuovo_utente();
