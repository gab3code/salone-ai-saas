-- Fase 5 -- Piano gestito a mano, per il pannello admin di Gabriel.
--
-- Il webhook Stripe è "l'unica fonte di verità per piano/stato_abbonamento"
-- (vedi src/app/api/stripe/webhook/route.ts) ed è giusto che lo resti: un
-- browser può dire "ho pagato" senza averlo fatto. Ma esistono due casi
-- reali in cui Stripe NON sa nulla del piano di un'attività:
--
--   1) Enterprise è a preventivo (vedi `pianoEPagante` in
--      src/lib/stripe/piani.ts): non passa dal checkout, quindi nessun
--      abbonamento Stripe potrà mai portare un tenant su "enterprise";
--   2) account omaggio/di prova (il primo cliente, un conoscente, una demo)
--      a cui va dato un piano superiore senza farlo pagare.
--
-- Senza questa colonna, l'unico modo per gestirli sarebbe scrivere `piano` a
-- mano nel database e vederselo sovrascrivere al primo evento Stripe di quel
-- tenant. Con questa colonna a true, il webhook lascia stare piano e
-- stato_abbonamento di quel tenant e continua a fare tutto il resto.
--
-- Deliberatamente NON è una seconda colonna "piano_forzato" da leggere al
-- posto di `piano`: `piano` resta l'unico campo che tutto il codice legge
-- (gate dei piani, limiti, AI, pagina pubblica), quindi non c'è nessun punto
-- del progetto in cui si possa dimenticare di controllare l'override.
alter table tenants
  add column piano_manuale boolean not null default false;

comment on column tenants.piano_manuale is
  'true = piano e stato_abbonamento gestiti a mano dal pannello admin; il webhook Stripe non li tocca. Usato per Enterprise (a preventivo) e per gli account omaggio.';
