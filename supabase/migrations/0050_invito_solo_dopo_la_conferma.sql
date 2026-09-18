-- L'invito non si consuma piu' prima della conferma dell'email (18/09/2026).
--
-- Fino a qui `gestisci_nuovo_utente` collegava l'utente al tenant che lo
-- aveva invitato gia' al momento della REGISTRAZIONE, cioe' prima che
-- l'indirizzo fosse confermato. Se la conferma email fosse disattivata sul
-- progetto Supabase -- un'impostazione che vive fuori dal codice, e che il
-- codice di /registrati gestisce esplicitamente -- chi indovina l'indirizzo
-- invitato (tipicamente info@ qualcosa) entrerebbe nell'attivita' di un
-- altro salone, con il ruolo che l'invito gli assegna.
--
-- La correzione non si fida dell'impostazione: la rende irrilevante.
--
-- Il ramo "nuovo titolare" resta identico a prima, perche' li' non c'e'
-- niente da rubare: un utente non confermato non riesce comunque ad
-- accedere, e il tenant che nasce e' suo.
--
-- Il ramo "invitato" invece aspetta. Se all'inserimento l'email risulta gia'
-- confermata (conferma disattivata: l'utente nasce confermato) l'invito si
-- consuma subito, come prima. Altrimenti non si fa NIENTE -- niente profilo,
-- niente appartenenza, niente invito consumato -- e si rimanda al momento in
-- cui la conferma arriva davvero, intercettato da un secondo trigger.
--
-- Effetto collaterale utile: un invito rimasto in sospeso resta valido e
-- riutilizzabile, invece di risultare gia' usato da qualcuno che non ha mai
-- confermato niente.

create or replace function public.collega_a_invito(
  p_user_id uuid,
  p_email text,
  p_nome text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  invito inviti_membro%rowtype;
begin
  select *
  into invito
  from inviti_membro
  where usato_il is null
    and scade_il > now()
    and lower(email) = lower(coalesce(p_email, ''))
  order by created_at desc
  limit 1;

  if not found then
    return false;
  end if;

  insert into profiles (id, tenant_id, ruolo, nome)
  values (p_user_id, invito.tenant_id, invito.ruolo, p_nome)
  on conflict (id) do update
     set tenant_id = excluded.tenant_id,
         ruolo = excluded.ruolo;

  insert into membri_tenant (user_id, tenant_id, ruolo)
  values (p_user_id, invito.tenant_id, invito.ruolo)
  on conflict (user_id, tenant_id) do update set ruolo = excluded.ruolo;

  update inviti_membro set usato_il = now() where id = invito.id;
  return true;
end;
$$;

create or replace function public.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nuovo_tenant_id uuid;
  nome_salone text;
  nome_persona text := nullif(trim(new.raw_user_meta_data->>'nome_persona'), '');
  ha_invito boolean;
begin
  select exists (
    select 1 from inviti_membro
     where usato_il is null
       and scade_il > now()
       and lower(email) = lower(coalesce(new.email, ''))
  ) into ha_invito;

  if ha_invito then
    -- Confermato gia' adesso (conferma email disattivata): si procede.
    -- Altrimenti si aspetta il trigger sulla conferma, qui sotto.
    if new.email_confirmed_at is not null then
      perform public.collega_a_invito(new.id, new.email, nome_persona);
    end if;
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
  values (new.id, nuovo_tenant_id, 'owner', nome_persona);

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

-- Il momento in cui la conferma arriva davvero.
create or replace function public.gestisci_email_confermata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nuovo_tenant_id uuid;
  nome_persona text := nullif(trim(new.raw_user_meta_data->>'nome_persona'), '');
begin
  -- Solo la transizione "non confermata -> confermata".
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  -- Gia' sistemato da qualcun altro: non si tocca niente.
  if exists (select 1 from profiles where id = new.id) then
    return new;
  end if;

  if public.collega_a_invito(new.id, new.email, nome_persona) then
    return new;
  end if;

  -- Nessun invito valido (scaduto, o gia' usato mentre aspettava): non lo si
  -- lascia senza niente, gli si da' la sua attivita' come a chiunque altro.
  insert into tenants (slug, nome)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome_salone'), ''), 'Il mio salone')
  )
  returning id into nuovo_tenant_id;

  insert into profiles (id, tenant_id, ruolo, nome)
  values (new.id, nuovo_tenant_id, 'owner', nome_persona);

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

drop trigger if exists alla_conferma_email on auth.users;
create trigger alla_conferma_email
  after update of email_confirmed_at on auth.users
  for each row execute function public.gestisci_email_confermata();

revoke execute on function public.collega_a_invito(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.gestisci_email_confermata() from public, anon, authenticated;
