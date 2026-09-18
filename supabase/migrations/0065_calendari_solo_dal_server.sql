-- 0065: i collegamenti dei calendari si leggono solo dal server.
--
-- Stessa mossa della 0051 sulla rubrica clienti, stesso motivo, e vale la
-- pena scriverlo perche' e' la seconda volta.
--
-- Dentro `collegamenti_calendario_esterni` ci sono due cose che non
-- appartengono al salone ma a UNA PERSONA: la password del suo calendario
-- CalDAV e il refresh token del suo Google. Sono cifrate a riposo dal
-- 17/09/2026 (vedi src/lib/cifratura.ts), ma finche' `authenticated` aveva
-- la SELECT, qualunque membro del salone poteva scaricarsi quelle righe con
-- una chiamata diretta a PostgREST, senza passare dal prodotto e senza
-- lasciare traccia. La cifratura alza il prezzo dell'attacco, non lo
-- impedisce: chi si porta via le righe si porta via anche la possibilita' di
-- provarci con calma.
--
-- Il PIANO descriveva questo problema come "credenziali in chiaro, leggibili
-- da chiunque nel tenant". La prima meta' non e' piu' vera da un giorno.
-- Questa migrazione chiude la seconda.
--
-- Da adesso l'unica porta e' src/lib/calendario-esterno/collegamenti.server.ts
-- (service_role, filtro tenant_id su ogni query, `esigiTenant` che fa
-- rumore se il tenant manca) piu' il callback OAuth di Google, che scrive
-- con il client admin SOLO dopo aver verificato con la sessione vera
-- dell'utente che l'operatore appartenga davvero al suo salone.
--
-- IL PREZZO, da tenere presente: con la service_role le policy RLS non
-- proteggono piu' niente su questa tabella. Il filtro `tenant_id` nel codice
-- smette di essere la seconda difesa e diventa l'unica. Per questo il modulo
-- ha un test che controlla ogni query una per una.

revoke select, insert, update, delete on public.collegamenti_calendario_esterni from authenticated;
revoke select, insert, update, delete on public.collegamenti_calendario_esterni from anon;

-- `eventi_calendario_esterni` e' la cache degli impegni scaricati. Oggi
-- nessuna riga di `src/` la legge o la scrive (gli impegni si rileggono dal
-- provider a ogni richiesta, vedi caricaImpegniEsterni): finche' resta cosi'
-- non c'e' motivo di lasciarla aperta. Se un domani servira' davvero, si
-- riaprira' con una migrazione che dice perche'.
revoke select, insert, update, delete on public.eventi_calendario_esterni from authenticated;
revoke select, insert, update, delete on public.eventi_calendario_esterni from anon;
