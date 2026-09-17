-- =====================================================================
-- 0030 -- I permessi di ruolo scendono nel database (17/09/2026)
--
-- Trovato in una revisione avversariale della Fase 6 ("revisione sicurezza:
-- RLS, permessi tool AI, rate limiting"). Il problema non era un buco
-- nell'isolamento fra saloni -- quello regge -- ma un livello più sotto:
--
--   RLS isolava i tenant ma non sapeva NIENTE dei ruoli.
--
-- Tutti i controlli owner/staff del progetto vivono nelle server action
-- (`richiediPermesso` in src/lib/permessi.server.ts). Le tabelle però sono
-- raggiungibili direttamente da PostgREST con la anon key -- che è pubblica
-- per definizione, sta nel bundle del browser -- più il JWT dell'utente, che
-- è nei suoi cookie. Chiunque sappia aprire la console del browser può quindi
-- parlare col database saltando completamente l'applicazione, e con lei ogni
-- gate di permesso.
--
-- Due conseguenze concrete, entrambe verificate leggendo policy e grant:
--
--  1. `create policy tenant_update on tenants for update using (id =
--     auth_tenant_id())` autorizzava l'UPDATE di TUTTE le colonne. Una PATCH
--     su /rest/v1/tenants con {"piano":"enterprise","piano_manuale":true}
--     regalava a chiunque il piano più caro, in modo PERMANENTE: con
--     `piano_manuale` acceso il webhook Stripe smette di correggere piano e
--     stato (è il meccanismo della migrazione 0028, qui rivoltato contro di
--     noi). Stessa strada per {"sospesa":false}: la sospensione decisa dal
--     pannello admin si annullava da sola.
--  2. Le policy `for all using (tenant_id = auth_tenant_id())` sulle tabelle
--     di configurazione non distinguono owner da staff. Un dipendente poteva
--     cancellare servizi, cambiare prezzi e orari -- esattamente ciò che
--     `puoConfigurareAttivita` gli nega nell'applicazione.
--
-- La regola che questa migrazione stabilisce, e che vale da qui in avanti:
-- **un permesso che esiste solo nel codice dell'applicazione non è un
-- permesso.** Se una cosa deve essere vietata a uno staff, deve essere
-- vietata anche a una richiesta HTTP diretta al database.
--
-- COSA NON RISOLVE, dichiarato invece che nascosto: uno staff legittimamente
-- LEGGE la rubrica clienti dentro il prodotto, quindi nessuna policy può
-- impedirgli di leggerla via PostgREST -- la differenza fra "guardare i
-- clienti uno per uno" e "portarsi via l'intero elenco" non è esprimibile in
-- SQL. Per chiudere davvero quella, le letture dei clienti dovrebbero passare
-- solo da server action con service_role: è un lavoro separato, annotato in
-- PIANO.md, non un'omissione di questa migrazione.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il ruolo, leggibile dalle policy
-- ---------------------------------------------------------------------
-- Stessa forma di `auth_tenant_id()` (migrazione 0001): security definer,
-- perché la policy su `profiles` non deve essere valutata mentre si sta
-- valutando un'altra policy.
create or replace function auth_ruolo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ruolo from profiles where id = auth.uid()
$$;

-- `admin_piattaforma` conta come owner dentro l'attività, esattamente come fa
-- `normalizzaRuolo()` in src/lib/ruoli.ts: le due definizioni devono restare
-- la stessa cosa, altrimenti UI e database direbbero due verità diverse.
-- Un ruolo NULL o sconosciuto non è owner: in caso di dato sporco si concede
-- meno potere, mai di più -- di nuovo come `normalizzaRuolo`.
create or replace function e_owner()
returns boolean
language sql
stable
as $$
  select coalesce(auth_ruolo() in ('owner', 'admin_piattaforma'), false)
$$;

grant execute on function auth_ruolo() to authenticated;
grant execute on function e_owner() to authenticated;

-- ---------------------------------------------------------------------
-- 2. tenants: niente più UPDATE su tutto
-- ---------------------------------------------------------------------
-- Due difese sovrapposte, di proposito.
--
-- La prima è il GRANT per colonne: Postgres verifica i privilegi di colonna
-- PRIMA di arrivare alle policy, quindi anche se un domani una policy venisse
-- riscritta male, `piano` resta inscrivibile da `authenticated`. È la difesa
-- che non dipende da noi.
--
-- La seconda è la policy, che aggiunge il ruolo: le colonne di
-- configurazione le tocca solo un owner, non uno staff.
drop policy if exists tenant_update on tenants;
create policy tenant_update on tenants
  for update
  using (id = auth_tenant_id() and e_owner())
  with check (id = auth_tenant_id() and e_owner());

revoke insert, update, delete on public.tenants from authenticated;

-- L'elenco è volutamente ESPLICITO e non "tutto tranne": una colonna nuova
-- aggiunta in futuro nasce non scrivibile dal browser, e chi la aggiunge deve
-- decidere apposta di concederla. Il default sbagliato deve costare una
-- migrazione, non passare inosservato.
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
  tono_ai_nota
) on public.tenants to authenticated;

-- Restano fuori, e ci restano apposta: piano, stato_abbonamento,
-- stripe_customer_id, stripe_subscription_id, piano_manuale, sospesa,
-- sospesa_motivo, sospesa_il, slug, id, created_at e le colonne whatsapp_*.
-- Le scrive solo chi ha il service_role: il webhook Stripe, il pannello
-- admin, il flusso di collegamento WhatsApp. Nessuna di queste è una
-- preferenza del titolare: sono lo stato di un contratto.

-- ---------------------------------------------------------------------
-- 3. Configurazione: scrittura riservata all'owner
-- ---------------------------------------------------------------------
-- Cosa sia "configurazione" è la stessa lista che l'applicazione già applica
-- in `puoConfigurareAttivita`: servizi, prezzi, operatori, orari, chiusure,
-- FAQ della knowledge base, regole dei promemoria, automazioni.
-- Lo staff continua a LEGGERE tutto (gli serve: la pagina di configurazione
-- gli è visibile in sola lettura, e il motore di disponibilità legge orari e
-- servizi con la sua sessione) -- cambia solo chi può scrivere.
do $$
declare
  tabella text;
begin
  foreach tabella in array array[
    'servizi',
    'operatori',
    'orari_apertura',
    'chiusure',
    'faq_attivita',
    'regole_promemoria',
    'automazioni'
  ]
  loop
    execute format('drop policy if exists isolamento_tabella on %I', tabella);
    execute format(
      'create policy lettura_tenant on %I for select using (tenant_id = auth_tenant_id())',
      tabella
    );
    execute format(
      'create policy scrittura_owner_insert on %I for insert with check (tenant_id = auth_tenant_id() and e_owner())',
      tabella
    );
    execute format(
      'create policy scrittura_owner_update on %I for update using (tenant_id = auth_tenant_id() and e_owner()) with check (tenant_id = auth_tenant_id() and e_owner())',
      tabella
    );
    execute format(
      'create policy scrittura_owner_delete on %I for delete using (tenant_id = auth_tenant_id() and e_owner())',
      tabella
    );
  end loop;
end $$;

-- operatori_servizi non ha `tenant_id`: la sua policy passa da `operatori`
-- (vedi 0001). Si riscrive con la stessa forma, aggiungendo il ruolo.
drop policy if exists isolamento_op_servizi on operatori_servizi;
create policy lettura_tenant on operatori_servizi
  for select
  using (exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id()));
create policy scrittura_owner_insert on operatori_servizi
  for insert
  with check (
    e_owner()
    and exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id())
  );
create policy scrittura_owner_delete on operatori_servizi
  for delete
  using (
    e_owner()
    and exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id())
  );

-- ---------------------------------------------------------------------
-- 4. Calendari esterni: collegarli e scollegarli è dell'owner
-- ---------------------------------------------------------------------
-- Le credenziali (password specifica iCloud, refresh token Google) restano
-- in chiaro in questa tabella -- il cifraggio a riposo è un'altra voce aperta
-- (vedi la nota nella migrazione 0008 e in PIANO.md, Fase 6bis) e NON viene
-- risolto qui. Quello che si può chiudere subito è la scrittura: nessuno
-- staff deve poter collegare o scollegare il calendario personale di un
-- collega.
drop policy if exists isolamento_tabella on collegamenti_calendario_esterni;
create policy lettura_tenant on collegamenti_calendario_esterni
  for select using (tenant_id = auth_tenant_id());
create policy scrittura_owner_insert on collegamenti_calendario_esterni
  for insert with check (tenant_id = auth_tenant_id() and e_owner());
create policy scrittura_owner_update on collegamenti_calendario_esterni
  for update using (tenant_id = auth_tenant_id() and e_owner())
  with check (tenant_id = auth_tenant_id() and e_owner());
create policy scrittura_owner_delete on collegamenti_calendario_esterni
  for delete using (tenant_id = auth_tenant_id() and e_owner());
