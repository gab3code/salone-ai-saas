-- Fase 6, lista d'attesa: aggiunto un terzo canale di iscrizione (13/09/2026,
-- domanda diretta di Gabriel "ma il cliente può mettersi in lista d'attesa
-- con l'AI o con la prenotazione online? senza che debba farlo lo staff?").
-- Rispondeva "sì con l'AI" ma "no dal flusso di prenotazione diretto" -- gap
-- vero, chiuso con `iscrivitiListaAttesaPubblico` in src/app/s/[slug]/azioni.ts.
--
-- `lista_attesa.creato_da` (migrazione 0013) accettava solo 'manuale'/'ai':
-- va allargato a 'pubblico', stessa terna già usata da `appuntamenti.creato_da`
-- (migrazione 0001) per distinguere lo stesso terzo canale.

alter table lista_attesa drop constraint lista_attesa_creato_da_check;
alter table lista_attesa
  add constraint lista_attesa_creato_da_check check (creato_da in ('manuale', 'ai', 'pubblico'));
