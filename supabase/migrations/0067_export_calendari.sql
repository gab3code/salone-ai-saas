-- 0067: gli appuntamenti del salone compaiono anche nel calendario personale.
--
-- Direzione EXPORT, l'ultima voce aperta di Fase 6bis. Fino a oggi i
-- calendari esterni si leggevano soltanto: gli impegni personali di
-- un'operatrice bloccavano gli slot, ma i suoi appuntamenti del salone non
-- comparivano da nessuna parte fuori dal prodotto. Chi vive dentro Google
-- Calendar doveva guardare due agende e ricordarsi di incrociarle.
--
-- DUE COLONNE, e ognuna evita un disastro diverso.
--
-- `esporta_appuntamenti` nasce FALSE per tutti. Non e' prudenza generica:
-- scrivere dentro il calendario personale di qualcuno e' un'azione che non
-- si annulla con un rollback, e nessuno deve trovarsi eventi nuovi in agenda
-- perche' noi abbiamo fatto un deploy. Si accende una persona alla volta,
-- dalle impostazioni, da chi quel calendario lo possiede.
--
-- `evento_esterno_id` e' l'id che Google assegna all'evento, conservato
-- sull'appuntamento. Senza, un appuntamento spostato o cancellato lascia sul
-- calendario personale un fantasma che continua a dire "quest'ora e' presa",
-- e nessuno puo' piu' toglierlo dal prodotto. E' la colonna che rende
-- l'export reversibile.
--
-- Nota su cosa NON c'e' qui: nessun permesso nuovo. Entrambe le tabelle sono
-- chiuse a `authenticated` e `anon` (0051 e 0065), e tutto passa dal server.

alter table collegamenti_calendario_esterni
  add column if not exists esporta_appuntamenti boolean not null default false;

comment on column collegamenti_calendario_esterni.esporta_appuntamenti is
  'true se gli appuntamenti del salone vanno scritti anche in questo calendario. Sempre false finche'' non lo accende il proprietario del calendario dalle impostazioni.';

alter table appuntamenti
  add column if not exists evento_esterno_id text;

comment on column appuntamenti.evento_esterno_id is
  'Id dell''evento corrispondente sul calendario esterno dell''operatore, quando l''export e'' acceso. NULL = non esportato (export spento, oppure la scrittura su Google non e'' riuscita: l''export e'' fail-open e non blocca mai una prenotazione).';
