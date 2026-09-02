-- Fix: le tabelle create da SQL Editor (invece che dall'interfaccia grafica
-- di Supabase) non ricevono in automatico i permessi di base per i ruoli
-- "anon"/"authenticated" -- servono GRANT espliciti, altrimenti anche con RLS
-- e policy corrette Postgres nega l'accesso PRIMA di valutare le policy
-- ("permission denied for table X", non un semplice "0 righe"). Le policy
-- RLS restano il vero controllo di isolamento tra tenant; questo file è il
-- prerequisito senza il quale RLS non viene nemmeno raggiunta.
--
-- service_role NON ha bisogno di nulla di tutto questo: bypassa RLS e ha già
-- pieno accesso alle tabelle di "public" per come Supabase lo configura di
-- default -- per questo admin.ts ha sempre funzionato senza questo file.
--
-- whatsapp_credenziali resta DI PROPOSITO senza alcun GRANT qui: deve restare
-- illeggibile/inscrivibile per chiunque non sia service_role, non solo grazie
-- alle policy RLS (che per quella tabella sono assenti apposta) ma anche a
-- livello di permessi di base -- doppia difesa per un vero segreto.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.orari_apertura to authenticated;
grant select, insert, update, delete on public.operatori to authenticated;
grant select, insert, update, delete on public.servizi to authenticated;
grant select, insert, update, delete on public.operatori_servizi to authenticated;
grant select, insert, update, delete on public.clienti to authenticated;
grant select, insert, update, delete on public.appuntamenti to authenticated;
grant select, insert, update, delete on public.conversazioni to authenticated;
grant select, insert, update, delete on public.messaggi to authenticated;
grant select, insert, update, delete on public.automazioni to authenticated;
grant select, insert, update, delete on public.chiusure to authenticated;
grant select on public.whatsapp_collegamento_log to authenticated;

-- NOTA per quando costruiremo la pagina pubblica del salone (Fase 4, punto
-- 19): quella pagina la vedono anche visitatori NON loggati, quindi servirà
-- un GRANT SELECT mirato al ruolo "anon" su tenants/servizi/operatori (solo
-- le colonne pubbliche) + una policy RLS dedicata "chiunque può leggere i
-- dati pubblici di un salone attivo" -- non ancora fatto qui di proposito,
-- va progettato insieme a quella pagina, non aggiunto alla cieca ora.
