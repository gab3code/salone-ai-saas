-- Fase 6, Lista d'attesa automatica alla cancellazione (PIANO.md Gruppo B
-- punto 3, 13/09/2026): gap visto su Calendix e CutApp -- quando un
-- appuntamento viene cancellato, invece di lasciare lo slot semplicemente
-- libero, si propone al primo cliente in coda per quel servizio (e,
-- opzionalmente, allo stesso operatore/allo stesso giorno se il cliente ne
-- aveva chiesto uno specifico).
--
-- Notifica diretta al CLIENTE non ancora possibile: zero provider email/SMS
-- collegato nel progetto oggi (vedi PIANO.md "Gruppo B-bis" punto 1, ancora
-- da costruire). Questa prima versione notifica il TITOLARE -- la riga passa
-- a stato "proposto" e diventa visibile in /dashboard/lista-attesa, da lì il
-- titolare contatta il cliente a mano (telefonata/messaggio). Quando
-- l'infrastruttura email/SMS esisterà, l'invio automatico al cliente si
-- aggiungerà SOPRA questa stessa tabella (stesso stato "proposto" da usare
-- come trigger), non la sostituirà.

create table lista_attesa (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  servizio_id uuid not null references servizi (id) on delete cascade,
  operatore_id uuid references operatori (id) on delete set null, -- null = qualunque operatore va bene
  cliente_nome text,
  cliente_telefono text not null,
  data_preferita date, -- null = qualunque giorno va bene
  note text,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'proposto', 'risolto', 'annullato')),
  -- Popolati SOLO quando una cancellazione fa scattare la proposta (vedi
  -- trovaEAvvisaListaAttesa in booking-engine.server.ts): lo slot esatto da
  -- riproporre al cliente quando il titolare lo contatta.
  slot_liberato_inizio timestamptz,
  slot_liberato_operatore_id uuid references operatori (id) on delete set null,
  creato_da text not null default 'manuale' check (creato_da in ('manuale', 'ai')),
  created_at timestamptz not null default now()
);

-- Match alla cancellazione: tenant + servizio + solo "in_attesa", ordinati
-- FIFO per created_at -- stesso identico ordine con cui vengono letti in
-- trovaEAvvisaListaAttesa (il primo della coda che soddisfa operatore/data
-- preferiti, se richiesti, vince).
create index lista_attesa_match_idx on lista_attesa (tenant_id, servizio_id, stato, created_at);

alter table lista_attesa enable row level security;

-- A differenza di richieste_caparra (sola lettura per il titolare, scrittura
-- solo da service_role perché tocca soldi reali via Stripe), qui il
-- titolare/staff deve poter aggiungere/rimuovere voci a mano (un cliente
-- chiama e chiede di essere messo in lista) -- stesso livello di fiducia già
-- dato a "clienti"/"appuntamenti".
create policy isolamento_tabella on lista_attesa for all using (tenant_id = auth_tenant_id());

grant select, insert, update, delete on public.lista_attesa to authenticated;
grant select, insert, update, delete on public.lista_attesa to service_role;
