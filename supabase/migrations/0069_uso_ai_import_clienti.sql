-- Un quarto tipo di uso AI interno: le righe dell'import della rubrica che il
-- codice non ha capito, passate al modello perche' proponga nome e numero.
--
-- Stesso contatore, stessa funzione `consuma_uso_ai_interno` (0059), stesso
-- tetto dell'onboarding: su Free e Starter un numero piccolo e fisso a vita,
-- sui piani con quota la quota mensile. Un tipo a se' e non "onboarding"
-- perche' le tre bozze di configurazione a vita sono una cosa e la lettura di
-- un elenco incollato un'altra: sommarle nello stesso contatore mostrerebbe
-- "bozze rimaste: 1" a chi non ha mai fatto una bozza.
alter table usi_ai_interni drop constraint if exists usi_ai_interni_tipo_check;
alter table usi_ai_interni
  add constraint usi_ai_interni_tipo_check
  check (tipo in ('onboarding', 'prova_assistente', 'follow_up', 'import_clienti'));
