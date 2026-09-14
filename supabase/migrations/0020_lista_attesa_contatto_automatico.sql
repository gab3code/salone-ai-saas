-- Contatto automatico della lista d'attesa (Fase 1, deciso con Gabriel il
-- 14/09/2026): oggi, quando `trovaEAvvisaListaAttesa`
-- (booking-engine.server.ts) trova un candidato compatibile alla
-- cancellazione di un appuntamento, la riga passa a stato "proposto" ma è il
-- titolare a contattare il cliente a mano (vede il banner in dashboard, poi
-- telefona/scrive). Questa migrazione aggiunge un contatto automatico
-- OPZIONALE, un toggle unico per tutto il salone (non per servizio).
--
-- Default `false` per OGNI tenant, esistente o nuovo: chi non tocca mai
-- questa impostazione mantiene esattamente il comportamento di oggi (nessun
-- messaggio automatico, il titolare continua a contattare a mano). Il
-- default della colonna copre già entrambi i casi -- a differenza di
-- `regole_promemoria` (migrazione 0017), qui non serve toccare il trigger
-- `gestisci_nuovo_utente` né fare un `insert ... select` sui tenant
-- esistenti: un booleano con default basta, non c'è nessuna riga da
-- popolare in una tabella collegata.
alter table tenants
  add column lista_attesa_contatto_automatico boolean not null default false;

-- Email del cliente in lista d'attesa, per poterlo contattare via email
-- (fallback SMS solo se il piano del tenant lo include, stessa logica già
-- usata per le notifiche di nuova prenotazione -- vedi
-- src/lib/email/notifiche.server.ts). Nullable: oggi solo il flusso pubblico
-- (`iscrivitiListaAttesaPubblico` in src/app/s/[slug]/azioni.ts) la
-- raccoglie -- dashboard e AI restano senza per ora, possibile estensione
-- futura.
alter table lista_attesa add column cliente_email text;
