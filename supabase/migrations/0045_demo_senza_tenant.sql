-- 0045 -- La demo smette di essere un salone vero (17/09/2026)
--
-- Smonta quello che le migrazioni 0042, 0043 e 0044 avevano costruito poche
-- ore prima. Non e' un ripensamento estetico: e' la risposta a una domanda di
-- Gabriel che ha trovato un difetto di fondo.
--
-- "se il responsabile inizia ad usare la demo come vero salone diventa un
-- problema serio".
--
-- Aveva ragione, e il difetto era piu' largo di cosi'. Un salone demo
-- costruito come TENANT VERO ha tre problemi che nessuna toppa chiude:
--
-- 1. E' indistinguibile da un salone vero per tutto il resto del sistema.
--    Ho gia' dovuto escluderlo a mano dal pannello di piattaforma (contava
--    129,80 euro di MRR mai incassati) e dal giro notturno dei promemoria.
--    Ma quelle erano le due cose che conoscevo OGGI: ogni job, ogni metrica e
--    ogni query scritti da domani dovrebbero ricordarsi `e_demo = false`. E'
--    una tassa su ogni funzione futura, e prima o poi qualcuno se la scorda.
-- 2. Qualcuno puo' usarla come salone vero, e il danno ricade sui suoi
--    clienti. In dashboard non ci entra (il tenant non ha nessun utente), ma
--    il link pubblico puo' darlo in giro: la gente prenota, l'assistente
--    conferma, e due giorni dopo la pulizia cancella tutto. Persone che si
--    presentano a un appuntamento che non esiste piu'.
-- 3. E' tantissima superficie per una funzione di marketing, su un prodotto
--    che non ha ancora incassato un euro.
--
-- La demo diventa senza stato: i dati del salone finto vivono nel codice,
-- l'agenda vive nella sessione di chi guarda, e NON SI SCRIVE NIENTE. Resta
-- l'assistente vero -- risponde davvero con il modello e calcola la
-- disponibilita' con `calcolaSlotDisponibili`, la stessa identica funzione
-- pura del motore di prenotazione, non una copia che le somiglia.
--
-- Cosa resta e cosa va via:
--  - i due saloni finti: VIA. Finche' esistono sono raggiungibili a /s/demo,
--    e il problema 2 resta aperto;
--  - `crea_clone_demo` e le colonne dei cloni (0044): VIA, non servono piu';
--  - `consuma_messaggio_demo` e le sue colonne (0043): VIA, il contatore non
--    puo' piu' stare su un tenant che non esiste. Lo sostituisce
--    `contatori_globali`;
--  - `e_demo` (0042): RESTA. Il codice gia' in produzione la legge in piu'
--    query, e toglierla adesso romperebbe il sito fino al deploy successivo.
--    Senza righe a true e' innocua, e si potra' togliere in un giro di
--    pulizia quando il deploy nuovo sara' online;
--  - `demo_ai_*` e `consuma_demo_ai` (0041): RESTANO, non c'entrano niente
--    con questa demo -- sono le dieci prove al mese del titolare Starter.

-- Verificato prima di cancellare: nessun appuntamento, nessun cliente,
-- nessuna conversazione era finito dentro questi due tenant.
delete from tenants where e_demo;

drop function if exists crea_clone_demo(text, text, text);
drop function if exists consuma_messaggio_demo(uuid, integer);

alter table tenants
  drop column if exists demo_clonato_da,
  drop column if exists demo_gruppo,
  drop column if exists messaggi_demo_mese,
  drop column if exists messaggi_demo_usati;

-- ---------------------------------------------------------------------
-- Il tetto della demo, senza un tenant a cui appoggiarlo
-- ---------------------------------------------------------------------
-- Una riga per contatore. Nasce per la demo ma e' deliberatamente generica:
-- e' il posto giusto per qualunque tetto mensile che non appartiene a un
-- singolo salone.
create table contatori_globali (
  chiave text primary key,
  mese text not null,
  usati integer not null default 0,
  aggiornato_at timestamptz not null default now()
);

-- Nessuna policy e nessun grant: ci arriva solo il service_role, che salta
-- comunque la RLS. Una tabella con RLS attiva e zero policy e' chiusa a
-- chiunque altro, che e' esattamente quello che serve.
alter table contatori_globali enable row level security;

-- Controlla e incrementa nella STESSA update, come le altre funzioni di
-- questo tipo: due richieste in volo insieme non consumano lo stesso posto.
-- Ritorna quanti ne restano, -1 se il tetto del mese e' pieno.
create or replace function consuma_contatore_globale(p_chiave text, p_limite integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mese_corrente text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_usati integer;
begin
  insert into contatori_globali (chiave, mese, usati)
  values (p_chiave, mese_corrente, 1)
  on conflict (chiave) do update
     set mese = mese_corrente,
         usati = case
                   when contatori_globali.mese is distinct from mese_corrente then 1
                   else contatori_globali.usati + 1
                 end,
         aggiornato_at = now()
   where contatori_globali.mese is distinct from mese_corrente
      or contatori_globali.usati < p_limite
  returning usati into v_usati;

  if v_usati is null then
    return -1;
  end if;
  return greatest(0, p_limite - v_usati);
end;
$$;

revoke all on function consuma_contatore_globale(text, integer) from public;
revoke all on function consuma_contatore_globale(text, integer) from anon;
revoke all on function consuma_contatore_globale(text, integer) from authenticated;
-- Terza volta che serve ricordarselo (0041, 0043, ora qui): un revoke da
-- PUBLIC chiude la funzione anche al service_role, che il permesso lo
-- eredita da li'. Dopo ogni revoke si ricontrolla con has_function_privilege.
grant execute on function consuma_contatore_globale(text, integer) to service_role;
