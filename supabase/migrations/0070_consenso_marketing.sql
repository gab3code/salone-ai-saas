-- Consenso marketing del cliente (19/09/2026, Fase 6quater).
--
-- Prima di questa migrazione il follow-up inattivi, gli auguri di compleanno
-- e la richiesta di recensione scrivevano a chi aveva prenotato online senza
-- che avesse mai detto si' a niente oltre la conferma dell'appuntamento. Il
-- GDPR distingue: la conferma e' esecuzione del contratto, "torna a
-- trovarci" e' marketing e vuole un consenso a parte, non pre-spuntato,
-- registrato con data e provenienza.
--
-- Tre stati, non due: NULL = mai chiesto (tutti i clienti esistenti), true,
-- false. La differenza fra NULL e false conta: un cliente che ha detto no
-- non va piu' interpellato; uno a cui non e' mai stato chiesto puo' esserlo.
--
-- Chi decide cosa parte con quale stato e' in codice (compleanno.server.ts,
-- promemoria.server.ts, recensioni.server.ts): auguri e follow-up SOLO con
-- true; la richiesta di recensione dopo un servizio anche con NULL (e' il
-- caso "soft spam" dell'art. 130 c. 4 del Codice Privacy: comunicazioni a
-- clienti esistenti su servizi analoghi, con possibilita' di opporsi), mai
-- con false.
alter table clienti
  add column consenso_marketing boolean,
  add column consenso_marketing_at timestamptz,
  add column consenso_marketing_fonte text
    check (consenso_marketing_fonte in ('prenotazione_online', 'import', 'scheda', 'chat'));

-- La caparra crea il cliente solo quando il webhook conferma il pagamento:
-- la casella spuntata sul form deve viaggiare fino a li'.
alter table richieste_caparra
  add column consenso_marketing boolean;
