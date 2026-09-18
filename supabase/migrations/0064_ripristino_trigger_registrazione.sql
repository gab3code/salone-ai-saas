-- 0064: rimette a posto il trigger di registrazione che la 0061 ha mutilato.
--
-- COSA E' SUCCESSO, perche' non si ripeta.
--
-- La 0061 doveva aggiungere due campi alla riga `tenants` creata alla
-- registrazione (piano 'growth' e la data di fine prova). Per farlo ha
-- riscritto `gestisci_nuovo_utente` partendo dalla versione della 0004 --
-- l'unica che avevo letto. Ma quella funzione era stata riscritta CINQUE
-- volte dopo: 0017 (regola promemoria predefinita), 0020, 0027
-- (`membri_tenant`), 0037, 0050 (l'invito che aspetta la conferma
-- dell'email). Un `create or replace` non fonde niente: sostituisce. Quindi
-- ha riportato indietro il corpo della funzione di dieci migrazioni,
-- silenziosamente, e nessun controllo se ne e' accorto -- tipi, lint, test
-- unitari e build parlano del codice TypeScript, non di cosa c'e' dentro una
-- funzione Postgres.
--
-- L'hanno trovato gli scenari Playwright: 18, 19, 20 e 29 sono diventati
-- rossi tutti insieme. Era l'unico controllo che poteva vederlo.
--
-- LA REGOLA CHE NE ESCE: prima di un `create or replace function`, cercare
-- TUTTE le migrazioni che definiscono quel nome, non solo quella che l'ha
-- creata. Una funzione Postgres non ha una storia leggibile nel database:
-- l'ultima versione cancella le precedenti senza lasciare traccia.
--
-- Questa migrazione riparte dal corpo della 0050 (l'ultima buona) e aggiunge
-- le due sole cose che la 0061 voleva davvero.

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
    -- Altrimenti si aspetta il trigger sulla conferma.
    if new.email_confirmed_at is not null then
      perform public.collega_a_invito(new.id, new.email, nome_persona);
    end if;
    return new;
  end if;

  nome_salone := coalesce(nullif(trim(new.raw_user_meta_data->>'nome_salone'), ''), 'Il mio salone');

  -- Le due righe della 0061, le uniche cose nuove rispetto alla 0050: la
  -- prova gratuita di Growth alla registrazione. Durante la prova il piano
  -- vale DAVVERO 'growth', cosi' i controlli sparsi nel progetto funzionano
  -- senza sapere niente della prova; il cron notturno la spegne alla
  -- scadenza e non tocca mai chi ha un abbonamento Stripe.
  insert into tenants (slug, nome, piano, prova_growth_fino_al)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    nome_salone,
    'growth',
    now() + interval '14 days'
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

drop trigger if exists al_nuovo_utente on auth.users;
create trigger al_nuovo_utente
  after insert on auth.users
  for each row execute function public.gestisci_nuovo_utente();

-- Lo stesso difetto, dall'altra parte: `gestisci_email_confermata` crea un
-- tenant anche lei (chi conferma l'email senza un invito valido), e la 0061
-- non l'aveva nemmeno guardata. Senza questa parte, la prova di Growth
-- tocca solo a chi si registra con la conferma email disattivata: due
-- utenti identici finirebbero su piani diversi a seconda di
-- un'impostazione del progetto Supabase.
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

  insert into tenants (slug, nome, piano, prova_growth_fino_al)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome_salone'), ''), 'Il mio salone'),
    'growth',
    now() + interval '14 days'
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

revoke execute on function public.gestisci_email_confermata() from public, anon, authenticated;
