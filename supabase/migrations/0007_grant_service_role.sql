-- Correzione di un'assunzione sbagliata scritta nel commento di 0005: NON è
-- vero che "service_role ha già pieno accesso alle tabelle di public per come
-- Supabase lo configura di default". Verificato dal vivo (Task #66, chat AI):
-- una query con il client service_role su public.tenants falliva con
-- "permission denied for table tenants" (Postgres 42501), non con 0 righe --
-- esattamente il sintomo descritto in 0005 per anon/authenticated, capitato
-- anche a service_role perché le tabelle sono state create da SQL Editor.
--
-- service_role bypassa le POLICY di RLS (BYPASSRLS), ma questo non lo esenta
-- dai GRANT di base a livello di tabella: sono due controlli indipendenti in
-- Postgres, e senza il primo il secondo non viene nemmeno raggiunto.
--
-- whatsapp_credenziali resta ESCLUSA anche qui? No: service_role deve poterci
-- scrivere (è l'unico modo in cui viene scritta, vedi
-- src/app/api/whatsapp/embedded-signup/callback/route.ts) -- l'esclusione in
-- 0005 riguardava solo anon/authenticated, non service_role.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.tenants to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.orari_apertura to service_role;
grant select, insert, update, delete on public.operatori to service_role;
grant select, insert, update, delete on public.servizi to service_role;
grant select, insert, update, delete on public.operatori_servizi to service_role;
grant select, insert, update, delete on public.clienti to service_role;
grant select, insert, update, delete on public.appuntamenti to service_role;
grant select, insert, update, delete on public.conversazioni to service_role;
grant select, insert, update, delete on public.messaggi to service_role;
grant select, insert, update, delete on public.automazioni to service_role;
grant select, insert, update, delete on public.chiusure to service_role;
grant select, insert, update, delete on public.whatsapp_credenziali to service_role;
grant select, insert, update, delete on public.whatsapp_collegamento_log to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Così le prossime tabelle create in questo schema non ripetono lo stesso
-- buco: qualunque ruolo esegua la prossima CREATE TABLE, service_role riceve
-- subito i permessi di base senza bisogno di un'altra migrazione come questa.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
