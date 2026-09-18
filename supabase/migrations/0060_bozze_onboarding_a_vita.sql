-- 0060: le bozze di configurazione su Free e Starter si contano A VITA.
--
-- Decisione di Gabriel del 18/09/2026, dopo aver guardato dove sta davvero
-- la leva commerciale: un salone che non paga puo' farsi preparare la
-- configurazione dall'AI TRE volte in tutto, non tre al mese. Quanto basta
-- per assaggiare -- configurare il salone la prima volta, e sbagliare un
-- paio di volte -- non abbastanza per usarla come strumento ricorrente.
-- Dopo, per continuare a farlo fare all'AI, serve un piano da Growth in su.
--
-- La prova dell'assistente resta invece MENSILE anche su Free e Starter: e'
-- l'altra meta' della stessa leva, cioe' far vedere l'assistente all'opera a
-- chi non ce l'ha, e azzerarla dopo tre volte toglierebbe proprio la cosa
-- che convince.
--
-- Da qui i due parametri nuovi: chi chiama dice SU QUALE FINESTRA contare.

drop function if exists consuma_uso_ai_interno(uuid, text, integer);

create or replace function consuma_uso_ai_interno(
  p_tenant_id uuid,
  p_tipo text,
  p_limite integer,
  p_da_sempre boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inizio_mese timestamptz := date_trunc('month', (now() at time zone 'utc'));
  v_usati integer;
begin
  if p_da_sempre then
    -- Finestra "da sempre": si conta SOLO questo tipo di uso, e non si
    -- sommano i messaggi dei clienti. Un tetto a vita sulle bozze non
    -- c'entra niente con quante volte i clienti hanno scritto al salone.
    select count(*) into v_usati
      from usi_ai_interni u
     where u.tenant_id = p_tenant_id and u.tipo = p_tipo;
  else
    -- Finestra mensile: e' la quota del salone, e la quota e' una sola per
    -- tutto quello che fa lavorare il modello.
    select
      (select count(*) from usi_ai_interni u
        where u.tenant_id = p_tenant_id and u.created_at >= v_inizio_mese)
      +
      (select count(*) from messaggi m
         join conversazioni c on c.id = m.conversazione_id
        where c.tenant_id = p_tenant_id
          and m.ruolo = 'cliente'
          and m.created_at >= v_inizio_mese)
    into v_usati;
  end if;

  if v_usati >= p_limite then
    return -1;
  end if;

  insert into usi_ai_interni (tenant_id, tipo) values (p_tenant_id, p_tipo);
  return p_limite - v_usati - 1;
end;
$$;

comment on function consuma_uso_ai_interno(uuid, text, integer, boolean) is
  'Controlla un tetto e ne consuma un''unita'', atomicamente. Con p_da_sempre = false conta la quota mensile del salone (messaggi dei clienti + usi dalla dashboard); con true conta a vita i soli usi di quel tipo. Restituisce quanti ne restano, oppure -1 se il tetto era gia'' raggiunto.';

revoke all on function consuma_uso_ai_interno(uuid, text, integer, boolean) from public;
revoke all on function consuma_uso_ai_interno(uuid, text, integer, boolean) from anon;
revoke all on function consuma_uso_ai_interno(uuid, text, integer, boolean) from authenticated;
grant execute on function consuma_uso_ai_interno(uuid, text, integer, boolean) to service_role;
