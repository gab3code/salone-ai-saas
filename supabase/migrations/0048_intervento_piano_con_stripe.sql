-- Il registro interventi non accettava "piano_con_stripe" (18/09/2026).
--
-- `cambiaPianoConStripe` in admin.server.ts scrive quell'azione da quando
-- esiste, ma il CHECK della 0029 e' rimasto alla lista di allora. Ogni
-- cambio piano fatto dall'admin passando da Stripe veniva quindi RIFIUTATO
-- dal database in fase di registrazione: il codice logga e tira dritto,
-- quindi l'intervento andava comunque a buon fine, ma senza traccia.
--
-- E' esattamente il caso peggiore: l'intervento piu' delicato che facciamo,
-- perche' muove un abbonamento vero, era l'unico invisibile nel registro.
-- Trovato leggendo i log di un run E2E, non da un test: nessun test guardava
-- la tabella interventi_admin dopo un cambio piano.
--
-- Il vincolo si ricrea invece di modificarlo: Postgres non ha un "alter
-- check", e riscriverlo per intero lascia nel file la lista completa, che
-- fra sei mesi e' l'unica cosa che si vuole leggere.

alter table interventi_admin
  drop constraint if exists interventi_admin_azione_check;

alter table interventi_admin
  add constraint interventi_admin_azione_check check (
    azione in (
      'piano_manuale',
      'piano_con_stripe',
      'ripristino_stripe',
      'sospensione',
      'riattivazione',
      'cancellazione_attivita'
    )
  );
