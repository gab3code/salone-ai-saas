-- Fase 1 (punto 12): servizi consecutivi nello stesso appuntamento.
--
-- La tabella `appuntamenti` resta con un solo `servizio_id` per riga (invariata
-- per tutto il resto del codice: metriche, CRM, export CSV, notifiche ecc.
-- continuano a leggere "un appuntamento = un servizio", zero rischio di
-- rompere query esistenti). Una prenotazione di più servizi consecutivi
-- (es. "manicure e pedicure" con lo stesso operatore, senza buchi) diventa
-- semplicemente più righe che condividono lo stesso `gruppo_prenotazione_id`
-- -- nullable: una prenotazione di un solo servizio (il caso normale, tutta
-- la storia del progetto finora) lascia questa colonna null, comportamento
-- identico a prima in ogni punto che non la conosce ancora.
--
-- Vedi src/lib/booking-engine.server.ts (creaAppuntamentoTenant) per la
-- logica di scrittura, e DECISIONS.md 16/09/2026 per il resto delle
-- decisioni di scope (notifiche multiple invece di una cumulativa, caparra
-- non supportata su una catena multi-servizio).

alter table appuntamenti
  add column gruppo_prenotazione_id uuid;

comment on column appuntamenti.gruppo_prenotazione_id is
  'Righe con lo stesso valore appartengono alla stessa prenotazione di servizi consecutivi (stesso operatore, orari senza buchi). Null = servizio singolo, comportamento di sempre.';

create index idx_appuntamenti_gruppo_prenotazione
  on appuntamenti (gruppo_prenotazione_id)
  where gruppo_prenotazione_id is not null;
