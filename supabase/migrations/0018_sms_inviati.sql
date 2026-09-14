-- SMS come canale di fallback su Pro/Enterprise (Fase 5+SMS, deciso con
-- Gabriel il 14/09/2026 -- vedi DECISIONS.md): quando un cliente non ha
-- lasciato un'email, la conferma di prenotazione e i Promemoria automatici
-- possono arrivare via SMS (Skebby, src/lib/sms/skebby.server.ts) invece che
-- via email, mai in aggiunta. L'SMS costa soldi VERI per messaggio -- questa
-- tabella traccia SOLO gli invii RIUSCITI (mai i tentativi falliti, che non
-- sono costati nulla), unica fonte per il tetto mensile per tenant
-- (limiteMensileSms in piani.ts, contaSmsTenantQuestoMese in
-- sms/limiti.server.ts). Nessuna colonna cliente_id/appuntamento_id
-- apposta: questa tabella serve solo a CONTARE quanti SMS un tenant ha già
-- mandato questo mese, non a tracciare "chi ha ricevuto cosa" (quello, se
-- mai servisse in futuro, si può risalire dai log applicativi).
create table sms_inviati (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  telefono text not null,
  created_at timestamptz not null default now()
);

-- Indice composto su (tenant_id, created_at): la query di conteggio mensile
-- (contaSmsTenantQuestoMese) filtra sempre su entrambi insieme.
create index sms_inviati_tenant_mese_idx on sms_inviati (tenant_id, created_at);

alter table sms_inviati enable row level security;

-- Stesso pattern di promemoria_appuntamento_inviati: sola lettura per lo
-- staff (potrà servire in dashboard per mostrare "SMS usati questo mese"),
-- scritture solo dal service_role -- un titolare non deve poter alterare il
-- proprio conteggio SMS per aggirare il tetto mensile.
create policy isolamento_tabella on sms_inviati for select using (tenant_id = auth_tenant_id());

grant select on public.sms_inviati to authenticated;
grant select, insert on public.sms_inviati to service_role;
