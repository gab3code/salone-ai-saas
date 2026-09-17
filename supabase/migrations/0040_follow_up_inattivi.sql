-- =====================================================================
-- 0040 -- Il follow-up "ci manchi" diventa configurabile (17/09/2026)
--
-- Richiesta di Gabriel, dopo che gliel'avevo segnalato come l'ultima
-- notifica ai clienti finali senza nessun controllo: "fallo anche per il
-- follow up".
--
-- Cosa faceva finora, senza che il salone potesse dire niente: ogni giorno
-- il cron cercava i clienti che non prenotano da 60 giorni esatti e mandava
-- loro un'email (o un SMS) a nome dell'attività. Numero fisso nel codice,
-- testo fisso nel codice, nessun interruttore. È l'unica notifica del
-- prodotto che parte di iniziativa nostra verso una persona che non ha
-- chiesto niente: proprio quella che il titolare deve poter governare.
--
-- Tre colonne, non una:
--
--  * `follow_up_inattivi_attivo` -- default TRUE, non false. È l'opposto del
--    promemoria di compleanno (0023), che nasce spento perché era una
--    funzione NUOVA: qui la funzione gira già, e un default false la
--    spegnerebbe da sola a tutti senza che nessuno l'abbia chiesto. Stessa
--    regola seguita poche ore fa per `conferma_cliente_canale`: una
--    migrazione non cambia il comportamento di nessuno da sola.
--
--  * `follow_up_inattivi_giorni` -- default 60, il valore che era hardcoded.
--    Il `check` tiene il valore fra 14 e 365: sotto le due settimane non è
--    più un "ci manchi" ma un assillo, sopra l'anno il messaggio arriva a
--    chi si è già dimenticato di te. Sono paletti larghi, non una scelta al
--    posto del titolare.
--
--  * `follow_up_inattivi_messaggio` -- testo libero con il segnaposto
--    `{nome}`, stesso meccanismo del messaggio di compleanno. Nullo = si usa
--    il testo predefinito.
--
-- ATTENZIONE, la parte che conta: questo numero NON è solo del follow-up.
-- "Chi non prenota da 60 giorni" è anche la card della dashboard e il filtro
-- di /dashboard/clienti, che oggi usano 60 scritto a mano in tre punti
-- diversi. Se il follow-up prendesse la soglia da qui e le altre due
-- restassero a 60, un salone che imposta 90 vedrebbe la dashboard dire una
-- cosa e le email partire su un'altra -- esattamente il tipo di divergenza
-- silenziosa trovata la notte prima fra il listino della landing e
-- `piani.ts`. Quindi la soglia configurata qui guida tutte e tre.
--
-- La finestra di ripetizione resta invece un asse a sé e NON scende sotto i
-- 60 giorni (vedi `promemoria.ts`): a uno stesso cliente non si riscrive più
-- di una volta ogni due mesi, anche se il titolare abbassa la soglia a 14.
-- Chi configura decide quando qualcuno è "sparito", non quanto spesso lo si
-- può ricontattare.
-- =====================================================================

alter table tenants
  add column follow_up_inattivi_attivo boolean not null default true,
  add column follow_up_inattivi_giorni integer not null default 60
    check (follow_up_inattivi_giorni between 14 and 365),
  add column follow_up_inattivi_messaggio text;

comment on column tenants.follow_up_inattivi_attivo is
  'false = nessun messaggio automatico ai clienti che non prenotano da un po''. Non tocca i promemoria pre-appuntamento.';

comment on column tenants.follow_up_inattivi_giorni is
  'Dopo quanti giorni senza prenotare un cliente è considerato "sparito". Guida ANCHE la card della dashboard e il filtro della rubrica, non solo l''invio.';

comment on column tenants.follow_up_inattivi_messaggio is
  'Testo libero con segnaposto {nome}. Nullo = testo predefinito.';

grant update (
  follow_up_inattivi_attivo,
  follow_up_inattivi_giorni,
  follow_up_inattivi_messaggio
) on public.tenants to authenticated;
