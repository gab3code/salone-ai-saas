-- =====================================================================
-- 0038 -- Gli indici che mancavano sulle query più frequenti (17/09/2026)
--
-- Trovato lanciando il linter di performance di Supabase durante il
-- controllo notturno: 24 chiavi esterne senza indice. Non le copro tutte --
-- ogni indice rallenta le scritture e molte di quelle 24 sono su tabelle
-- che si leggono una volta ogni tanto. Qui ci sono solo quelle sui percorsi
-- che il prodotto attraversa a ogni richiesta.
--
-- LA PIÙ IMPORTANTE, e fa impressione che sia rimasta scoperta dalla 0001:
-- `appuntamenti` non aveva NESSUN indice su `tenant_id`. Ogni pagina della
-- dashboard, ogni calcolo di disponibilità, ogni metrica e ogni risposta
-- dell'assistente fanno `where tenant_id = ...` su quella tabella. Senza
-- indice, Postgres legge l'intera tabella degli appuntamenti di TUTTI i
-- saloni per rispondere a ciascuna di quelle domande. Con tre saloni di
-- prova non si vede; con trenta saloni veri diventa la prima cosa che
-- rallenta, e la si scopre quando i clienti se ne accorgono.
--
-- L'indice è composto `(tenant_id, inizio)` e non solo su `tenant_id`:
-- praticamente nessuna query chiede "tutti gli appuntamenti di questo
-- salone", chiedono sempre anche una finestra temporale (oggi, questa
-- settimana, da qui a 30 giorni). Un indice composto le serve tutte, e vale
-- anche come indice sul solo `tenant_id` perché ne è il prefisso.
--
-- `niente_sovrapposizioni` non aiutava: è un indice GiST su
-- `(operatore_id, tstzrange(...))` filtrato su `stato = 'confermato'`, cioè
-- risponde a una domanda diversa (questo slot è occupato?) e ignora le
-- righe cancellate e i no-show.
--
-- Gli altri quattro, nello stesso ordine di frequenza:
--  - `messaggi (conversazione_id, created_at)`: ogni singolo turno di chat
--    ricarica lo storico della conversazione, ordinato per data.
--  - `servizi (tenant_id)` e `operatori (tenant_id)`: si leggono a ogni
--    apertura della pagina pubblica e a ogni calcolo di disponibilità.
--  - `appuntamenti (cliente_id)`: la scheda cliente, e la cancellazione di
--    un cliente introdotta oggi (la FK è `on delete set null`, quindi
--    Postgres deve trovare le righe da azzerare).
--  - `profiles (tenant_id)`: usato per risalire al titolare a ogni email di
--    notifica e per l'elenco dei membri.
--
-- `concurrently` NON si usa: non funziona dentro una transazione, e le
-- tabelle oggi sono abbastanza piccole perché il lock duri millisecondi. Il
-- momento per aggiungere indici è adesso, prima dei primi clienti veri.
-- =====================================================================

create index if not exists appuntamenti_tenant_inizio_idx
  on appuntamenti (tenant_id, inizio);

create index if not exists appuntamenti_cliente_idx
  on appuntamenti (cliente_id)
  where cliente_id is not null;

create index if not exists messaggi_conversazione_idx
  on messaggi (conversazione_id, created_at);

create index if not exists servizi_tenant_idx
  on servizi (tenant_id);

create index if not exists operatori_tenant_idx
  on operatori (tenant_id);

create index if not exists profiles_tenant_idx
  on profiles (tenant_id);
