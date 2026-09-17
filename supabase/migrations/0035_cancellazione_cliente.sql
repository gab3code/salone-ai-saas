-- =====================================================================
-- 0035 -- Cancellare un singolo cliente, e solo il titolare (17/09/2026)
--
-- Trovato nel controllo notturno chiesto da Gabriel, confrontando le pagine
-- legali con quello che il codice permette davvero.
--
-- L'informativa privacy dice, dei dati dei clienti finali: "Sono dati suoi,
-- e la decisione di cancellarli è sua". Non era vero: `clienti/azioni.ts`
-- esportava solo `aggiornaCliente`. L'unico modo per far sparire un cliente
-- era cancellare l'intera attività dal pannello di piattaforma. Un salone
-- che riceve una richiesta di cancellazione da un suo cliente (art. 17 GDPR)
-- non aveva nessun modo di soddisfarla -- e siamo noi, nell'accordo art. 28,
-- ad avergli promesso che lo assistiamo quando succede.
--
-- Due modi per rimettere in pari il prodotto e le pagine legali: ammorbidire
-- la pagina, o costruire la cancellazione. Costruirla è l'unica che regge,
-- perché quell'obbligo il salone ce l'ha comunque, con o senza la nostra
-- frase.
--
-- PERCHÉ UNA MIGRAZIONE E NON SOLO UNA SERVER ACTION. Regola stabilita dalla
-- 0030: un permesso che esiste solo nel codice dell'applicazione non è un
-- permesso. `clienti` ha ancora la policy originale `isolamento_tabella for
-- all`, che autorizza QUALUNQUE membro del tenant -- staff compreso -- a
-- fare DELETE via PostgREST con la anon key. Restringere la cancellazione al
-- solo owner nella server action e lasciare la policy com'è significherebbe
-- scrivere un cancello e lasciare il muro aperto di fianco.
--
-- La divisione ricalca quella della 0030, con una differenza voluta:
-- INSERT e UPDATE restano a tutti i membri. Uno staff crea clienti nuovi e
-- corregge un numero di telefono ogni giorno lavorativo -- è il suo mestiere.
-- La cancellazione no: è irreversibile, e per un titolare che scopre una
-- scheda sparita non c'è modo di sapere se è stato un errore o un dispetto.
--
-- COSA SUCCEDE AGLI APPUNTAMENTI. Niente, ed è voluto: le tre chiavi esterne
-- verso `clienti` (appuntamenti, conversazioni, recensioni) sono tutte
-- `on delete set null`. Lo storico resta, il nome se ne va -- che è
-- esattamente la forma di cancellazione che serve qui: il salone perde il
-- dato personale, non il fatturato dell'anno scorso.
-- =====================================================================

drop policy if exists isolamento_tabella on clienti;

create policy lettura_tenant on clienti
  for select using (tenant_id = auth_tenant_id());

create policy scrittura_membri_insert on clienti
  for insert with check (tenant_id = auth_tenant_id());

create policy scrittura_membri_update on clienti
  for update using (tenant_id = auth_tenant_id());

-- `e_owner()` è definita dalla 0030: security definer, legge il ruolo dal
-- profilo dell'utente corrente, considera owner anche l'admin di piattaforma
-- e in caso di ruolo sconosciuto risponde false (nega, non concede).
create policy cancellazione_owner on clienti
  for delete using (tenant_id = auth_tenant_id() and e_owner());
