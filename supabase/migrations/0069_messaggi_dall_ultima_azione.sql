-- Il tetto anti-abuso per conversazione conta dall'ULTIMA COSA SUCCESSA,
-- non dall'inizio della chat.
--
-- IL CASO VERO, 19/09/2026. Gabriel prenota (martedi' 22 alle 17:00, creato
-- davvero), poi nella stessa chat scrive "ciao" e ne prenota un'altra. Al
-- sedicesimo messaggio -- quello con nome, cognome e telefono, cioe' l'ultimo
-- prima della conferma -- scatta il tetto di 15 e il cliente legge "Non riesco
-- a risponderti oltre da qui".
--
-- Il tetto serve a fermare chi consuma quota senza prenotare niente. Una
-- conversazione che ha GIA' prodotto una prenotazione e' la prova del
-- contrario, e tagliarla esattamente mentre ne sta facendo una seconda e' il
-- peggior momento possibile: al salone costa la prenotazione, non a noi.
--
-- Da qui il contatore si azzera quando uno strumento che SCRIVE riesce
-- (crea/modifica/cancella prenotazione, iscrizione alla lista d'attesa). Il
-- tetto resta 15, ma 15 "da quando non succede piu' niente".
--
-- Resta comunque un tetto assoluto sull'intera conversazione (vedi limiti.ts):
-- azzerare all'infinito creando e cancellando prenotazioni non deve diventare
-- il modo di aggirare la difesa.
alter table conversazioni
  add column if not exists messaggi_cliente_da_azione integer not null default 0;

comment on column conversazioni.messaggi_cliente_da_azione is
  'Messaggi del cliente da quando un''azione e'' riuscita davvero (0 = appena successo qualcosa). Contatore anti-abuso, vedi limiti.ts.';
