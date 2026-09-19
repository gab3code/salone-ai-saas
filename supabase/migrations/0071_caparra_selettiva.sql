-- Caparra selettiva (19/09/2026, Fase 6quater).
--
-- Chiedere la caparra a tutti frena le prenotazioni dei clienti buoni; non
-- chiederla a nessuno espone ai furbi. La via di mezzo che i saloni usano
-- gia' a mano: caparra obbligatoria solo per chi ha gia' saltato.
--
--   caparra_regola = 'tutti'         -> come prima, a ogni prenotazione online;
--   caparra_regola = 'dopo_no_show'  -> solo a chi ha almeno
--                                       caparra_no_show_soglia appuntamenti
--                                       con stato 'no_show' in questo salone.
--
-- Il conteggio dei no-show non e' una colonna: si deriva dagli appuntamenti,
-- riconoscendo il cliente dal telefono (la chiave della rubrica). Un cliente
-- mai visto ha zero no-show e non paga niente. Chi decide e' in codice
-- (src/lib/stripe/caparra.ts): qui solo l'impostazione.
alter table tenants
  add column caparra_regola text not null default 'tutti'
    check (caparra_regola in ('tutti', 'dopo_no_show')),
  add column caparra_no_show_soglia integer not null default 1
    check (caparra_no_show_soglia > 0);
