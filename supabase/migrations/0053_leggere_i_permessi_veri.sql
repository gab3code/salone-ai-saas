-- Far leggere al codice i permessi VERI del database (18/09/2026).
--
-- Serve al comando `npm run permessi`, che confronta quello che le
-- migrazioni dichiarano con quello che il database concede davvero.
-- Nasce da due incidenti nello stesso giorno, in direzioni opposte:
--
--   * la 0030 -- revoche fatte a mano in produzione e mai scritte in un
--     file: ricostruendo il database dal repo sarebbe nato spalancato;
--   * la 0051 -- revoca scritta nel file e applicata al database di test,
--     ma non in produzione, per ore, con il codice gia' online. Il prodotto
--     funzionava benissimo: quel permesso non lo usa piu' nessuno. Cambiava
--     solo chi poteva scaricarsi la rubrica saltando l'applicazione.
--
-- Nessun test poteva accorgersene, perche' i test girano sul database di
-- test -- che era giusto.
--
-- Si legge da `pg_class.relacl` e `pg_attribute.attacl` invece che da
-- `information_schema`: quest'ultimo mostra solo i permessi che l'utente
-- corrente e' autorizzato a vedere, quindi avrebbe potuto tacere proprio
-- nel caso in cui serve parlare.
--
-- SICUREZZA: la funzione dice a chi puo' fare cosa, che e' una mappa utile a
-- chi volesse cercare una crepa. Percio' l'esecuzione resta al solo
-- `service_role` -- la chiave che sta sul server e mai nel browser.

create or replace function public.permessi_correnti()
returns table (tabella text, ruolo text, privilegio text, colonna text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- Permessi sull'intera tabella.
  select c.relname::text,
         a.grantee::regrole::text,
         a.privilege_type::text,
         null::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.grantee::regrole::text in ('anon', 'authenticated', 'service_role')

  union all

  -- Permessi concessi su singole colonne (vedi 0030: `tenants` e' governata
  -- cosi', colonna per colonna).
  select c.relname::text,
         a.grantee::regrole::text,
         a.privilege_type::text,
         att.attname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
  cross join lateral aclexplode(att.attacl) a
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.grantee::regrole::text in ('anon', 'authenticated', 'service_role');
$$;

revoke all on function public.permessi_correnti() from public;
revoke all on function public.permessi_correnti() from anon;
revoke all on function public.permessi_correnti() from authenticated;
grant execute on function public.permessi_correnti() to service_role;
