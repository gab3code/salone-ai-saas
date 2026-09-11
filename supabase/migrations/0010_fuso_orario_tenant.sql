-- Corregge il problema noto #1 di PROJECT_STATUS.md: finora tutto il
-- booking engine trattava l'ora del salone come se coincidesse con UTC
-- (vedi la nota storica in booking-engine.server.ts). Il fuso vero del
-- tenant è il primo tassello per convertire correttamente ai due confini
-- dove il tempo deve essere davvero assoluto: la colonna timestamptz di
-- "appuntamenti" e le API di calendario esterne (Google/CalDAV).
--
-- Default 'Europe/Rome' perché tutti i tenant di oggi sono saloni
-- italiani -- un tenant futuro in un altro fuso lo cambia dalle
-- impostazioni (UI non ancora costruita: per ora un valore diverso si
-- imposta a mano via SQL se mai servisse).
alter table public.tenants
  add column fuso_orario text not null default 'Europe/Rome';
