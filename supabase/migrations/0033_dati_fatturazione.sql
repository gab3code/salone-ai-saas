-- =====================================================================
-- 0033 -- I dati di fatturazione diventano nostri (17/09/2026)
--
-- Fino alla 0031 partita IVA e indirizzo restavano sul Customer di Stripe,
-- che li raccoglieva al checkout, e da noi c'erano solo i due campi SdI che
-- Stripe non conosce. Quella divisione cade per un limite di Stripe: i campi
-- personalizzati di Checkout si definiscono quando la sessione viene creata,
-- quindi non possono diventare obbligatori in base a quello che l'utente
-- spunta nella pagina, e non si possono riposizionare. Volendo entrambe le
-- cose, il modulo deve essere nostro -- e chi possiede il modulo possiede i
-- dati.
--
-- Da qui in avanti la fattura si compone leggendo QUESTE colonne, non
-- Stripe. I valori vengono comunque rispecchiati sul Customer di Stripe, così
-- portale e ricevute restano coerenti, ma in caso di divergenza la verità è
-- qui.
--
-- Tutte nullable: un'attività su Free o in prova non ha niente da fatturare e
-- non le si chiede niente. Il modulo le rende obbligatorie solo quando si sta
-- per passare a un piano a pagamento.
--
-- Non scrivibili da `authenticated`: la 0030 concede l'UPDATE su un elenco
-- esplicito di colonne e queste non ci entrano, quindi nascono chiuse. Le
-- scrive la server action del modulo, dopo il controllo di permesso.
-- =====================================================================

alter table tenants
  add column denominazione text,
  add column partita_iva text,
  add column indirizzo_via text,
  add column indirizzo_cap text,
  add column indirizzo_comune text,
  add column indirizzo_provincia text,
  add column indirizzo_nazione text default 'IT';

comment on column tenants.denominazione is
  'Ragione sociale per la fattura. Diversa da tenants.nome, che è il nome commerciale mostrato ai clienti del salone.';
comment on column tenants.partita_iva is
  'Partita IVA, 11 cifre senza prefisso IT. Validata con il carattere di controllo prima del salvataggio.';
comment on column tenants.indirizzo_provincia is
  'Sigla di 2 lettere (es. BG). La fattura elettronica la vuole separata dal comune.';
