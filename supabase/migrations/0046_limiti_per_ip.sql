-- 0046 -- Un tetto all'uso dell'AI per ogni IP (17/09/2026)
--
-- Richiesta di Gabriel dopo l'audit: "se e' quello per dare un limite diverso
-- a ciascun [visitatore] che usa la demo allora e' assolutamente da mettere,
-- e bisogna anche mettere limiti su ogni uso dell'AI da parte di ciascun ip".
--
-- COSA MANCAVA. Tutte le difese anti-abuso della chat pubblica erano
-- agganciate a `identificatore_sessione`, che pero' lo sceglie il client:
-- uno script che ne genera uno nuovo a ogni richiesta apriva ogni volta una
-- conversazione "fresca" e saltava l'intervallo minimo fra messaggi, il tetto
-- per conversazione e il contatore dei turni fuori tema. Restava solo la
-- quota mensile del tenant, che una persona sola poteva bruciare in pochi
-- minuti -- togliendola ai clienti veri di quel salone.
-- Sulla demo il problema era lo stesso al contrario: il tetto mensile globale
-- e' condiviso, quindi un visitatore insistente poteva consumare quello di
-- tutti gli altri.
--
-- QUESTO E' IL PRIMO LIMITE CHE NON SI AGGIRA CAMBIANDO QUALCOSA NEL CLIENT.
-- L'IP non lo decide chi chiama: lo mette la piattaforma. Vale per la demo E
-- per la chat dei saloni veri, perche' il problema e' lo stesso e una difesa
-- scritta due volte diverge.
--
-- DUE FINESTRE, NON UNA. Una oraria contro la raffica, una giornaliera contro
-- chi va piano ma non si ferma mai. Con la sola oraria, uno script che manda
-- il massimo ogni ora consuma comunque una quota mensile in pochi giorni.
--
-- NELLA TABELLA NON C'E' NESSUN INDIRIZZO IP. La chiave e' un'impronta
-- (SHA-256 con un sale del server, vedi src/lib/limiti-ip.server.ts): serve a
-- riconoscere che due richieste vengono dalla stessa parte, non a sapere da
-- dove. Un indirizzo IP e' un dato personale, e per contare non serve
-- conservarlo. Le righe si cancellano da sole dopo 48 ore.

create table limiti_ip (
  chiave text not null,
  finestra timestamptz not null,
  usati integer not null default 1,
  primary key (chiave, finestra)
);

create index limiti_ip_finestra_idx on limiti_ip (finestra);

alter table limiti_ip enable row level security;

create or replace function consuma_limite_ip(
  p_chiave text,
  p_limite_ora integer,
  p_limite_giorno integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finestra timestamptz := date_trunc('hour', now());
  v_giorno integer;
  v_usati integer;
begin
  select coalesce(sum(usati), 0) into v_giorno
    from limiti_ip
   where chiave = p_chiave
     and finestra > now() - interval '24 hours';

  if v_giorno >= p_limite_giorno then
    return -1;
  end if;

  insert into limiti_ip (chiave, finestra, usati)
  values (p_chiave, v_finestra, 1)
  on conflict (chiave, finestra) do update
     set usati = limiti_ip.usati + 1
   where limiti_ip.usati < p_limite_ora
  returning usati into v_usati;

  if v_usati is null then
    return -1;
  end if;

  return least(p_limite_ora - v_usati, p_limite_giorno - v_giorno - 1);
end;
$$;

create or replace function pulisci_limiti_ip()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancellate integer;
begin
  delete from limiti_ip where finestra < now() - interval '48 hours';
  get diagnostics v_cancellate = row_count;
  return v_cancellate;
end;
$$;

revoke all on function consuma_limite_ip(text, integer, integer) from public;
revoke all on function consuma_limite_ip(text, integer, integer) from anon;
revoke all on function consuma_limite_ip(text, integer, integer) from authenticated;
grant execute on function consuma_limite_ip(text, integer, integer) to service_role;

revoke all on function pulisci_limiti_ip() from public;
revoke all on function pulisci_limiti_ip() from anon;
revoke all on function pulisci_limiti_ip() from authenticated;
grant execute on function pulisci_limiti_ip() to service_role;
