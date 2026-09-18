-- 0061: chi si registra prova Growth per due settimane, senza carta.
--
-- Una prova c'era gia', ma era un'altra cosa: i 10 giorni prima del primo
-- addebito (`giorniDiProva` in src/lib/stripe/piani.ts), che pero' si
-- ottengono solo arrivando al checkout e lasciando una carta. Chi si
-- registrava e basta finiva su Free, cioe' senza l'assistente: il prodotto
-- si faceva giudicare senza far vedere la cosa per cui esiste.
--
-- La scelta implementativa che conta: durante la prova `tenants.piano` vale
-- DAVVERO 'growth'. Cosi' i circa cento controlli di piano sparsi nel
-- progetto continuano a funzionare senza sapere niente della prova.
-- L'alternativa -- un "piano effettivo" calcolato a ogni controllo --
-- avrebbe voluto dire toccare quel centinaio di posti e sbagliarne uno.
--
-- Il prezzo di questa scelta e' che la prova va SPENTA quando scade, se no
-- resta Growth per sempre: lo fa il cron giornaliero, e chi ha un
-- abbonamento Stripe non viene mai toccato.

alter table tenants
  add column if not exists prova_growth_fino_al timestamptz,
  add column if not exists avviso_prova_inviato boolean not null default false;

comment on column tenants.prova_growth_fino_al is
  'Fine della prova gratuita di Growth iniziata alla registrazione. NULL = nessuna prova in corso (mai iniziata, gia'' scaduta e declassata, oppure diventata un abbonamento vero).';

comment on column tenants.avviso_prova_inviato is
  'true se il titolare ha gia'' ricevuto l''email "la prova sta per finire". Una volta sola, non ogni notte.';

-- I tenant che esistono gia' non ricevono una prova retroattiva: chi e' su
-- Free ci e' rimasto avendo gia' visto il prodotto, e regalargli Growth
-- adesso sarebbe una sorpresa, non una prova.

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

  -- 'growth' + data di fine: la prova e' il piano vero, non un'eccezione da
  -- ricordarsi in ogni controllo.
  insert into tenants (slug, nome, piano, prova_growth_fino_al)
  values (
    'salone-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    nome_salone,
    'growth',
    now() + interval '14 days'
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

drop trigger if exists al_nuovo_utente on auth.users;
create trigger al_nuovo_utente
  after insert on auth.users
  for each row execute function public.gestisci_nuovo_utente();
