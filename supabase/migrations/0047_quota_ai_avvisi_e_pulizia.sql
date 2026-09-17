-- 0047 -- L'avviso di quota AI quasi finita, e la pulizia dei contatori per IP
-- (17/09/2026)
--
-- Due cose che arrivano dalla stessa conversazione con Gabriel.
--
-- 1. L'AVVISO. Fino a oggi, quando un salone finiva la quota mensile di
--    messaggi AI, l'assistente semplicemente smetteva di rispondere ai suoi
--    clienti -- e il titolare lo scopriva solo se glielo diceva qualcuno,
--    perche' da nessuna parte era scritto quanti messaggi avesse usato. Un
--    cliente che PAGA si ritrovava il prodotto spento a meta' mese per un
--    limite che protegge noi, non lui. Questa colonna ricorda il mese in cui
--    l'avviso e' gia' partito, cosi' non riparte ogni notte.
--
-- 2. LA PULIZIA. Il tetto per connessione sulla demo e' diventato MENSILE
--    (prima era orario e giornaliero), e un contatore mensile non puo' vivere
--    nella tabella `limiti_ip`, che viene ripulita dopo 48 ore: sarebbe
--    esattamente il bug del tetto che si azzerava da solo, gia' visto e
--    corretto oggi. Vive quindi in `contatori_globali`, che si azzera da
--    solo al cambio mese -- ma li' dentro ora nasce una riga per ogni
--    connessione, quindi serve toglierle quando il mese e' passato.
--    Si tiene anche il mese scorso: serve a non perdere il conto di chi sta
--    usando la demo a cavallo della mezzanotte del primo.

alter table tenants
  add column avviso_quota_ai_mese text;

comment on column tenants.avviso_quota_ai_mese is
  'Mese (YYYY-MM, UTC) in cui è già stato mandato l''avviso di quota AI quasi esaurita.';

create or replace function pulisci_contatori_globali()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancellate integer;
  v_mese_scorso text := to_char((now() at time zone 'utc') - interval '1 month', 'YYYY-MM');
begin
  delete from contatori_globali
   where chiave like 'demo_ip:%'
     and mese < v_mese_scorso;
  get diagnostics v_cancellate = row_count;
  return v_cancellate;
end;
$$;

revoke all on function pulisci_contatori_globali() from public;
revoke all on function pulisci_contatori_globali() from anon;
revoke all on function pulisci_contatori_globali() from authenticated;
-- Terza volta oggi: un revoke da PUBLIC chiude la funzione anche al
-- service_role, che il permesso lo eredita da li'.
grant execute on function pulisci_contatori_globali() to service_role;
