-- 0044 -- Un salone demo per visitatore (17/09/2026)
--
-- Gabriel: "ma e' una demo uguale per tutti? se e' cosi' non va bene".
-- Aveva ragione. Con una demo sola, chi prenota martedi' alle 15 la toglie a
-- tutti quelli che arrivano dopo: con un po' di traffico la demo sembra
-- sempre piena, e chi prova vede le tracce di sconosciuti.
--
-- PERCHE' CLONARE UN TENANT INVECE DI FILTRARE PER SESSIONE. La strada
-- ovvia sarebbe una colonna "sessione" su `appuntamenti` piu' un filtro
-- ovunque. Ma il motore di prenotazione legge `appuntamenti` in NOVE punti
-- diversi, e andrebbe modificato anche il vincolo `niente_sovrapposizioni`,
-- che e' l'invariante piu' importante del prodotto -- la difesa contro la
-- doppia prenotazione, messa nel database proprio perche' non ci fidiamo del
-- codice applicativo. Dimenticare un filtro vorrebbe dire un visitatore che
-- vede la prenotazione di un altro; sbagliarlo dalla parte opposta vorrebbe
-- dire due clienti VERI allo stesso orario.
--
-- Il prodotto e' gia' multi-tenant: ogni lettura e' gia' filtrata per
-- `tenant_id`, e quell'isolamento e' gia' collaudato e gia' testato. Quindi
-- ogni visitatore riceve un salone tutto suo, clonato dal modello. Zero
-- modifiche al motore, zero modifiche al vincolo, isolamento perfetto --
-- perche' il clone E' un salone vero.
--
-- E' anche la strada per la personalizzazione: un clone puo' essere seminato
-- dal modello per un visitatore anonimo, o dai servizi e dagli orari VERI di
-- un titolare che ha gia' configurato tutto.

alter table tenants
  -- Nullo = questo e' un MODELLO (i due saloni della 0042). Valorizzato = e'
  -- il clone di un visitatore, e da qui si risale al modello per contare la
  -- quota AI in un posto solo.
  add column demo_clonato_da uuid references tenants (id) on delete cascade,
  -- I due cloni (Growth e Pro) dello stesso visitatore condividono questo
  -- valore: e' quello che permette all'interruttore in cima alla pagina di
  -- trovare il gemello.
  add column demo_gruppo text;

comment on column tenants.demo_clonato_da is
  'Nullo sui due modelli, valorizzato sui cloni dei visitatori. Serve anche a contare la quota AI sul modello invece che sul clone, altrimenti ogni visitatore avrebbe la sua quota intera.';

comment on column tenants.demo_gruppo is
  'Lega fra loro i cloni Growth e Pro dello stesso visitatore.';

create index tenants_demo_gruppo_idx on tenants (demo_gruppo) where demo_gruppo is not null;
create index tenants_demo_clonato_idx on tenants (demo_clonato_da, created_at) where demo_clonato_da is not null;

-- ---------------------------------------------------------------------
-- Il clone
-- ---------------------------------------------------------------------
-- Atomico di proposito: un clone a cui mancassero gli orari o gli
-- abbinamenti operatore-servizio sarebbe una demo rotta che non dice niente
-- sul prodotto. O nasce intero o non nasce.
create or replace function crea_clone_demo(
  p_modello_slug text,
  p_slug text,
  p_gruppo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modello tenants%rowtype;
  v_clone_id uuid;
  v_nuovo_id uuid;
  v_riga record;
  -- La corrispondenza vecchio->nuovo id sta in due coppie di array e non in
  -- tabelle temporanee: una `create temporary table ... on commit drop`
  -- dentro una funzione esplode alla seconda chiamata nella stessa
  -- transazione, e questa funzione viene chiamata due volte di fila (una per
  -- il clone Growth e una per quello Pro).
  v_servizi_vecchi uuid[] := '{}';
  v_servizi_nuovi uuid[] := '{}';
  v_operatori_vecchi uuid[] := '{}';
  v_operatori_nuovi uuid[] := '{}';
begin
  select * into v_modello from tenants
   where slug = p_modello_slug and e_demo and demo_clonato_da is null;
  if not found then
    -- Si clona SOLO un modello. Senza questo controllo la funzione sarebbe
    -- un modo per duplicare il salone di chiunque.
    raise exception 'crea_clone_demo: % non e'' un modello di demo', p_modello_slug;
  end if;

  insert into tenants (
    slug, nome, descrizione, indirizzo, piano, stato_abbonamento, e_demo,
    fuso_orario, ore_minime_cancellazione, caparra_attiva,
    notifica_titolare_nuova_prenotazione, follow_up_inattivi_attivo,
    raccolta_recensioni_attiva, piano_manuale,
    parcheggio, metodi_pagamento, tono_ai,
    demo_clonato_da, demo_gruppo
  )
  values (
    p_slug, v_modello.nome, v_modello.descrizione, v_modello.indirizzo,
    v_modello.piano, v_modello.stato_abbonamento, true,
    v_modello.fuso_orario, v_modello.ore_minime_cancellazione, false,
    false, false, false, true,
    v_modello.parcheggio, v_modello.metodi_pagamento, v_modello.tono_ai,
    v_modello.id, p_gruppo
  )
  returning id into v_clone_id;

  insert into orari_apertura (tenant_id, giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine)
  select v_clone_id, giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine
    from orari_apertura where tenant_id = v_modello.id;

  insert into faq_attivita (tenant_id, domanda, risposta)
  select v_clone_id, domanda, risposta
    from faq_attivita where tenant_id = v_modello.id;

  -- Servizi e operatori si copiano UNO A UNO, tenendo da parte la
  -- corrispondenza fra vecchio e nuovo id: subito dopo serve per rifare gli
  -- abbinamenti operatore-servizio fra i NUOVI id. Senza, il clone avrebbe
  -- operatori che non sanno fare niente e nessuno slot libero da nessuna
  -- parte, cioe' una demo che dimostra il contrario di quello che deve.
  --
  -- Un ciclo e non un INSERT ... SELECT con join sul nome: due servizi
  -- chiamati uguale nello stesso salone (che il database permette) farebbero
  -- esplodere le righe in un prodotto cartesiano, e la demo nascerebbe con
  -- abbinamenti sbagliati senza nessun errore. Qui sono sei servizi e tre
  -- operatori: la chiarezza vale piu' di una query sola.
  for v_riga in select id, nome, descrizione, categoria, durata_minuti, prezzo_centesimi, attivo
                  from servizi where tenant_id = v_modello.id order by id
  loop
    insert into servizi (tenant_id, nome, descrizione, categoria, durata_minuti, prezzo_centesimi, attivo)
    values (v_clone_id, v_riga.nome, v_riga.descrizione, v_riga.categoria,
            v_riga.durata_minuti, v_riga.prezzo_centesimi, v_riga.attivo)
    returning id into v_nuovo_id;
    v_servizi_vecchi := v_servizi_vecchi || v_riga.id;
    v_servizi_nuovi := v_servizi_nuovi || v_nuovo_id;
  end loop;

  for v_riga in select id, nome, ruolo, attivo
                  from operatori where tenant_id = v_modello.id order by id
  loop
    insert into operatori (tenant_id, nome, ruolo, attivo)
    values (v_clone_id, v_riga.nome, v_riga.ruolo, v_riga.attivo)
    returning id into v_nuovo_id;
    v_operatori_vecchi := v_operatori_vecchi || v_riga.id;
    v_operatori_nuovi := v_operatori_nuovi || v_nuovo_id;
  end loop;

  insert into operatori_servizi (operatore_id, servizio_id)
  select v_operatori_nuovi[array_position(v_operatori_vecchi, os.operatore_id)],
         v_servizi_nuovi[array_position(v_servizi_vecchi, os.servizio_id)]
    from operatori_servizi os
   where os.operatore_id = any (v_operatori_vecchi)
     and os.servizio_id = any (v_servizi_vecchi);

  return v_clone_id;
end;
$$;

revoke all on function crea_clone_demo(text, text, text) from public;
revoke all on function crea_clone_demo(text, text, text) from anon;
revoke all on function crea_clone_demo(text, text, text) from authenticated;
-- Senza questo il revoke da PUBLIC chiude la funzione anche al server.
-- Errore gia' commesso con la 0041 e con la 0043: terza volta, quindi vale
-- la pena scriverlo come regola -- dopo ogni revoke su una funzione si
-- ricontrolla chi resta con has_function_privilege.
grant execute on function crea_clone_demo(text, text, text) to service_role;
