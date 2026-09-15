-- Knowledge base per l'AI receptionist (Fase 2, deciso con Gabriel il
-- 15/09/2026): oggi l'AI in chat (`/s/[slug]`) risponde SOLO a domande
-- transazionali (servizi/prezzi/durate/disponibilità/prenotazioni) tramite
-- gli strumenti di src/lib/ai/tools.ts -- zero capacità di rispondere a
-- domande informative generali sull'attività ("avete parcheggio?",
-- "accettate carte?", "quanto costa cancellare?"). Questa migrazione
-- aggiunge i campi strutturati per le domande comuni/prevedibili + una
-- tabella FAQ libera per tutto il resto. Riservato a Pro/Enterprise via
-- `pianoHaKnowledgeBaseAi` in src/lib/piani.ts (gate applicativo, non nel
-- database) -- leva di upsell rispetto alla chat AI base già inclusa da
-- Growth in su.
--
-- La policy di cancellazione NON ha un campo nuovo: riusa
-- `tenants.ore_minime_cancellazione`, già esistente dalla migrazione 0016 e
-- già editabile in /dashboard/impostazioni/cancellazione -- un solo dato,
-- una sola fonte di verità, mai due posti diversi che potrebbero disallinearsi.

alter table tenants add column parcheggio text;
alter table tenants add column metodi_pagamento text;

-- Bio/specializzazione opzionale del professionista (oggi `operatori` ha
-- solo nome/foto/ruolo/attivo, vedi 0001_init.sql) -- usata sia in
-- `elenca_operatori` (strumento AI) sia in futuro sulla pagina pubblica.
alter table operatori add column descrizione text;

-- FAQ libere, un domanda/risposta per riga -- stesso identico pattern di
-- `lista_attesa` (0013)/`regole_promemoria` (0017): RLS isolata per tenant,
-- grant a authenticated (il titolare gestisce da dashboard) e service_role
-- (lo strumento `info_attivita` legge con il client admin dal widget
-- pubblico, dove non esiste nessun utente Supabase autenticato).
create table faq_attivita (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  domanda text not null,
  risposta text not null,
  created_at timestamptz not null default now()
);

create index faq_attivita_tenant_idx on faq_attivita (tenant_id, created_at);

alter table faq_attivita enable row level security;

create policy isolamento_tabella on faq_attivita for all using (tenant_id = auth_tenant_id());

grant select, insert, update, delete on public.faq_attivita to authenticated;
grant select, insert, update, delete on public.faq_attivita to service_role;
