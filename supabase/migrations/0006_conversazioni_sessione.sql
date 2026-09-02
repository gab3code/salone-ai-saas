-- Le conversazioni via chat web (Fase 2) non hanno sempre un cliente_id
-- risolto fin dal primo messaggio: un visitatore anonimo scrive prima di
-- essere identificato per nome/telefono (a differenza di WhatsApp, dove il
-- numero identifica subito il mittente). Serve un modo per ritrovare "la
-- stessa conversazione" tra un messaggio e il successivo dello stesso
-- browser, senza aspettare l'identificazione -- un identificatore di
-- sessione generato e salvato lato client (localStorage) al primo
-- messaggio, non un utente Supabase (il visitatore non fa mai login).
alter table conversazioni add column identificatore_sessione text;

-- Lookup frequente per il canale chat web: "trova la conversazione aperta
-- di questa sessione per questo tenant" -- una query per ogni messaggio in
-- arrivo. Parziale: la maggior parte delle righe (WhatsApp, identificate da
-- cliente_id) non ha questo valore.
create index conversazioni_sessione_idx
  on conversazioni (tenant_id, identificatore_sessione)
  where identificatore_sessione is not null;
