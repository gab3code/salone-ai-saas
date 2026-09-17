-- 0041 -- La prova dell'assistente per i piani senza AI (Fase 5, 17/09/2026)
--
-- Chiude l'ultimo punto aperto della Fase 5: il riquadro che mostra a un
-- salone Starter (o Free) cosa avrebbe risposto l'assistente al posto suo.
-- Gabriel ha scelto "AI risposta vera ma un limite vero", e il limite vero
-- vive QUI, non nel codice dell'applicazione.
--
-- PERCHE' NEL DATABASE E NON IN UNA SERVER ACTION. Due motivi, entrambi
-- concreti:
--   1. Un contatore letto, confrontato e riscritto da due schede aperte
--      insieme si perde: leggono entrambe 4, scrivono entrambe 5, e la
--      quinta prova non e' mai stata contata. Qui il controllo e
--      l'incremento sono la stessa UPDATE, quindi o passa o non passa.
--   2. E' la regola gia' imparata a spese nostre con la migrazione 0030: un
--      permesso che esiste solo nel codice dell'applicazione non e' un
--      permesso. PostgREST e' raggiungibile con la chiave pubblica e il JWT
--      del titolare, quindi un limite scritto solo in TypeScript si aggira
--      dalla console del browser.
--
-- Le due colonne NON entrano in nessun `grant update`: dalla migrazione
-- 0030 l'UPDATE su tenants e' revocato e riconcesso colonna per colonna, e
-- una colonna nuova nasce chiusa. E' proprio quello che serve -- il
-- titolare non deve poter azzerare il proprio contatore -- quindi qui non
-- si concede niente, di proposito. Si scrivono solo dalla funzione qui
-- sotto, che gira come `security definer` ed e' eseguibile solo dal
-- service_role.

alter table tenants
  add column demo_ai_mese text,
  add column demo_ai_usate integer not null default 0;

comment on column tenants.demo_ai_mese is
  'Mese (YYYY-MM, UTC) a cui si riferisce demo_ai_usate. Cambiando mese il contatore riparte da capo.';

comment on column tenants.demo_ai_usate is
  'Prove dell''assistente consumate nel mese in demo_ai_mese. Scritta SOLO da consuma_demo_ai(): nessun grant update al titolare, che altrimenti si azzererebbe il limite da solo.';

-- Consuma una prova e dice quante ne restano.
-- Ritorna -1 quando il limite del mese e' gia' esaurito (e in quel caso non
-- scrive niente). Il mese e' in UTC: per un tetto mensile la differenza con
-- il fuso del salone vale al massimo poche ore una volta al mese, e non
-- giustifica di portare qui dentro la conversione di fuso-orario.ts.
create or replace function consuma_demo_ai(p_tenant_id uuid, p_limite integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mese_corrente text := to_char(now() at time zone 'utc', 'YYYY-MM');
  usate integer;
begin
  update tenants
     set demo_ai_mese = mese_corrente,
         demo_ai_usate = case
                           when demo_ai_mese is distinct from mese_corrente then 1
                           else demo_ai_usate + 1
                         end
   where id = p_tenant_id
     and (demo_ai_mese is distinct from mese_corrente or demo_ai_usate < p_limite)
  returning demo_ai_usate into usate;

  if usate is null then
    return -1;
  end if;
  return greatest(0, p_limite - usate);
end;
$$;

-- Solo il service_role. `authenticated` non deve poterla chiamare
-- direttamente: passerebbe il limite che vuole come secondo parametro.
revoke all on function consuma_demo_ai(uuid, integer) from public;
revoke all on function consuma_demo_ai(uuid, integer) from anon;
revoke all on function consuma_demo_ai(uuid, integer) from authenticated;

-- ATTENZIONE (errore trovato e corretto il 17/09/2026, subito dopo la prima
-- applicazione): i tre `revoke` qui sopra tolgono anche il permesso che
-- `service_role` aveva ereditato da PUBLIC, e senza questa riga la funzione
-- non e' chiamabile NEMMENO dal server -- cioe' dall'unico posto da cui
-- deve essere chiamata. Il controllo che lo dimostra:
--   select has_function_privilege('service_role',
--     'consuma_demo_ai(uuid, integer)', 'execute');
grant execute on function consuma_demo_ai(uuid, integer) to service_role;
