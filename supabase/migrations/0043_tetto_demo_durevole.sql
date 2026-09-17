-- 0043 -- Il tetto della demo deve sopravvivere alla pulizia (17/09/2026)
--
-- CORREZIONE DI UN BUG INTRODOTTO DA ME POCHE ORE PRIMA, nello stesso giro
-- che ha creato il salone dimostrativo. Trovato perche' Gabriel ha chiesto
-- "sicuro che la demo non ci fa buttare via soldi e non puo' essere
-- sfruttata?" invece di fidarsi.
--
-- COSA NON FUNZIONAVA. La quota mensile dell'AI si conta interrogando la
-- tabella `messaggi` dall'inizio del mese (`contaMessaggiClienteQuestoMese`
-- in limiti.server.ts). Nella stessa giornata ho aggiunto la pulizia dei
-- dati della demo, che cancella le `conversazioni` piu' vecchie di due
-- giorni -- e `messaggi` ha `on delete cascade` su `conversazione_id`.
-- Risultato: ogni notte la pulizia cancellava proprio le righe che il
-- contatore contava, e il tetto mensile si azzerava da solo ogni due giorni.
-- Un tetto da 400 messaggi al mese diventava di fatto 400 ogni due giorni,
-- cioe' circa quindici volte tanto -- su un endpoint pubblico che paghiamo
-- noi.
--
-- Nessuno se ne sarebbe accorto guardando il codice: le due cose sono in
-- file diversi e ognuna, presa da sola, e' giusta. Si vede solo mettendole
-- insieme.
--
-- LA CORREZIONE. Il contatore non puo' vivere nei dati che cancelliamo.
-- Vive su `tenants`, come quello delle prove dell'assistente (migrazione
-- 0041): due colonne, chiuse in scrittura a tutti tranne il service_role, e
-- una funzione che controlla e incrementa nella STESSA update.
--
-- Perche' una seconda funzione quasi identica a `consuma_demo_ai` invece di
-- generalizzarne una sola: una funzione generica dovrebbe ricevere il nome
-- della colonna come parametro e costruire l'UPDATE in SQL dinamico, che e'
-- piu' fragile e piu' difficile da leggere di quindici righe ripetute. I due
-- contatori contano cose diverse, su tenant diversi, con vite diverse.

alter table tenants
  add column messaggi_demo_mese text,
  add column messaggi_demo_usati integer not null default 0;

comment on column tenants.messaggi_demo_mese is
  'Mese (YYYY-MM, UTC) a cui si riferisce messaggi_demo_usati.';

comment on column tenants.messaggi_demo_usati is
  'Messaggi AI consumati questo mese dal salone dimostrativo. Sta qui e non si conta dalla tabella messaggi perche la pulizia notturna cancella le conversazioni della demo, e con loro i messaggi che un conteggio userebbe.';

create or replace function consuma_messaggio_demo(p_tenant_id uuid, p_limite integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mese_corrente text := to_char(now() at time zone 'utc', 'YYYY-MM');
  usati integer;
begin
  update tenants
     set messaggi_demo_mese = mese_corrente,
         messaggi_demo_usati = case
                                 when messaggi_demo_mese is distinct from mese_corrente then 1
                                 else messaggi_demo_usati + 1
                               end
   where id = p_tenant_id
     and e_demo
     and (messaggi_demo_mese is distinct from mese_corrente or messaggi_demo_usati < p_limite)
  returning messaggi_demo_usati into usati;

  if usati is null then
    return -1;
  end if;
  return greatest(0, p_limite - usati);
end;
$$;

-- Il `and e_demo` nella where non e' decorazione: impedisce che questa
-- funzione possa essere usata per toccare il contatore di un salone vero.
revoke all on function consuma_messaggio_demo(uuid, integer) from public;
revoke all on function consuma_messaggio_demo(uuid, integer) from anon;
revoke all on function consuma_messaggio_demo(uuid, integer) from authenticated;
-- Senza questo il revoke da PUBLIC chiude la funzione anche al server, che
-- e' l'unico che deve poterla chiamare. Errore gia' commesso con la 0041.
grant execute on function consuma_messaggio_demo(uuid, integer) to service_role;
