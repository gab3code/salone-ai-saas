-- Le revoche che esistevano solo in produzione (18/09/2026).
--
-- Trovata ricostruendo il database da zero su un progetto vuoto, per il
-- database di test separato. Lo schema combaciava con produzione: tabelle,
-- colonne, policy, tutto identico. I PERMESSI no.
--
-- Nel database ricostruito dai soli file, il ruolo `anon` -- cioe' la chiave
-- pubblica, quella che sta nel browser di chiunque apra la pagina di un
-- salone -- aveva INSERT, UPDATE e DELETE su tutte e 28 le tabelle. In
-- produzione non ne ha nessuno.
--
-- Il motivo e' un default di Supabase: ogni tabella nuova nasce con i
-- permessi pieni per anon, authenticated e service_role, e le migrazioni
-- non li hanno mai tolti. In produzione erano stati revocati a mano, e
-- quella revoca non era in nessun file. Ricostruendo il database da questo
-- repo -- dopo un disastro, o per un ambiente nuovo -- sarebbe nato
-- spalancato, e nessuno se ne sarebbe accorto: le policy RLS coprono il
-- caso, ma diventano l'unica linea di difesa invece della seconda.
--
-- E' lo stesso principio gia' scritto nella 0030: un permesso che esiste
-- solo nella testa di chi l'ha tolto a mano non e' un permesso.
--
-- Qui si azzera e si riconcede esattamente quello che serve, cosi' il file
-- dice per intero chi puo' scrivere dove. Le SELECT non si toccano: quelle
-- le governano le policy, e la pagina pubblica ne ha bisogno.

revoke insert, update, delete on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;

-- Le sedici tabelle su cui un utente loggato scrive davvero, sempre e solo
-- dentro il proprio tenant (a decidere quello sono le policy).
grant insert, update, delete on public.appuntamenti to authenticated;
grant insert, update, delete on public.automazioni to authenticated;
grant insert, update, delete on public.chiusure to authenticated;
grant insert, update, delete on public.clienti to authenticated;
grant insert, update, delete on public.collegamenti_calendario_esterni to authenticated;
grant insert, update, delete on public.conversazioni to authenticated;
grant insert, update, delete on public.eventi_calendario_esterni to authenticated;
grant insert, update, delete on public.faq_attivita to authenticated;
grant insert, update, delete on public.lista_attesa to authenticated;
grant insert, update, delete on public.messaggi to authenticated;
grant insert, update, delete on public.operatori to authenticated;
grant insert, update, delete on public.operatori_servizi to authenticated;
grant insert, update, delete on public.orari_apertura to authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.regole_promemoria to authenticated;
grant insert, update, delete on public.servizi to authenticated;

-- `tenants` va RICONCESSA colonna per colonna, e qui c'e' una trappola che
-- ha morso davvero mentre scrivevo questo file: un REVOKE sulla TABELLA
-- porta via anche i grant di COLONNA. Credevo di no. Senza le righe qui
-- sotto, la 0030 veniva annullata e il titolare non poteva piu' cambiare
-- nemmeno il nome del proprio salone.
--
-- L'ha trovato il confronto degli schemi fra il database ricostruito e
-- quello di produzione, subito dopo aver applicato la prima versione di
-- questa stessa migrazione. Senza quel confronto sarebbe finita in
-- produzione.
grant update (
  nome,
  descrizione,
  indirizzo,
  telefono,
  email,
  sito_web,
  social,
  logo_url,
  cover_url,
  fuso_orario,
  ore_minime_cancellazione,
  parcheggio,
  metodi_pagamento,
  caparra_attiva,
  caparra_tipo,
  caparra_valore,
  compleanno_attivo,
  compleanno_messaggio,
  lista_attesa_contatto_automatico,
  raccolta_recensioni_attiva,
  tono_ai,
  tono_ai_nota,
  telefono_whatsapp,
  notifica_titolare_nuova_prenotazione,
  conferma_cliente_canale,
  follow_up_inattivi_attivo,
  follow_up_inattivi_giorni,
  follow_up_inattivi_messaggio
) on public.tenants to authenticated;

-- E le tabelle che verranno create domani: senza questa riga rinascerebbe
-- lo stesso problema alla prossima migrazione che aggiunge una tabella.
alter default privileges in schema public revoke insert, update, delete on tables from anon;
alter default privileges in schema public revoke insert, update, delete on tables from authenticated;
