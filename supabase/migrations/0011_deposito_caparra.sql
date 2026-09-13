-- Fase 6, Deposito/caparra anti-no-show (deciso con Gabriel il 13/09/2026,
-- "quando hai finito di controllare inizia il lavoro seguendo gli md" --
-- vedi PIANO.md, Gruppo B punto 1). Nessun gestionale italiano diretto
-- (Estetia, Calendix, Skedula, WeGest, CutApp) offre oggi una caparra
-- richiesta al momento della prenotazione online -- solo i marketplace
-- (Fresha, Booksy) ce l'hanno. Configurabile per tenant: attiva/disattiva,
-- tipo (percentuale sul prezzo del servizio o importo fisso), valore.

alter table tenants
  add column caparra_attiva boolean not null default false,
  add column caparra_tipo text not null default 'percentuale' check (caparra_tipo in ('percentuale', 'fisso')),
  add column caparra_valore integer not null default 20 check (caparra_valore > 0);
-- caparra_valore: se tipo='percentuale', percento del prezzo del servizio
-- (validato 1-100 in codice applicativo); se tipo='fisso', importo in
-- centesimi. Un solo limite comune ("> 0") a livello DB: un range 1-100 non
-- avrebbe senso per un importo fisso in centesimi, quindi il resto della
-- validazione vive dove i due casi si distinguono (src/lib/stripe/caparra.ts
-- + il form impostazioni), non qui.

-- Traccia SOLO l'esito di un pagamento caparra riuscito, sull'appuntamento
-- che ne è risultato -- per mostrarlo in dashboard/storico cliente.
alter table appuntamenti
  add column caparra_importo_centesimi integer,
  add column caparra_stripe_payment_intent_id text;

-- Una riga per ogni tentativo di pagamento caparra, creata PRIMA di sapere se
-- andrà a buon fine. L'appuntamento vero e proprio (tabella "appuntamenti",
-- con la sua difesa anti-doppia-prenotazione) viene creato SOLO quando il
-- webhook riceve "checkout.session.completed" -- stessa unica fonte di
-- verità di sempre (punto 9 di CLAUDE.md: creaAppuntamentoTenant), mai
-- prima: niente appuntamento "fantasma" non pagato in calendario.
--
-- Limite onestamente segnalato (vedi anche PROJECT_STATUS.md): lo slot NON
-- è bloccato durante il pagamento, quindi due clienti potrebbero avviare il
-- pagamento della caparra per lo stesso slot quasi in contemporanea -- chi
-- completa il pagamento per secondo trova il conflitto al momento della
-- creazione dell'appuntamento e viene rimborsato automaticamente (vedi
-- webhook), ma resta un'esperienza peggiore che bloccare davvero lo slot.
-- Accettabile al primo rilascio (nessun salone reale ha ancora il traffico
-- perché due persone scelgano lo stesso slot nella stessa finestra di
-- pochi minuti); da rivedere se diventa un problema reale.
create table richieste_caparra (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  servizio_id uuid not null references servizi (id) on delete cascade,
  operatore_id uuid not null references operatori (id) on delete cascade,
  -- Stringa ISO "pseudo-UTC" così come arriva dal client (vedi
  -- src/lib/fuso-orario.ts): riparsata identicamente con parsaOrarioLocale
  -- al momento della creazione dell'appuntamento, mai un secondo formato.
  inizio_iso text not null,
  cliente_nome text not null,
  cliente_telefono text not null,
  importo_centesimi integer not null check (importo_centesimi > 0),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'completata', 'fallita_conflitto', 'annullata')),
  appuntamento_id uuid references appuntamenti (id) on delete set null,
  errore text,
  created_at timestamptz not null default now()
);

create index richieste_caparra_tenant_idx on richieste_caparra (tenant_id, created_at desc);

alter table richieste_caparra enable row level security;

-- Solo lettura per il titolare (dashboard: vedere caparre in sospeso/fallite,
-- stesso motivo per cui vede gli appuntamenti) -- scritture SOLO da
-- service_role (server action pubblica di avvio + webhook): un titolare non
-- deve poter marcare a mano una caparra come "completata" senza che Stripe
-- l'abbia davvero confermata.
create policy isolamento_tabella on richieste_caparra for select using (tenant_id = auth_tenant_id());

grant select on public.richieste_caparra to authenticated;
grant select, insert, update, delete on public.richieste_caparra to service_role;
