-- 0056: le regole con cui ogni salone riempie la propria agenda.
--
-- Fino a qui il motore usava gli stessi identici numeri per tutti: passo di
-- 15 minuti e buffer zero. Il buffer era pure peggio di "non configurabile":
-- il parametro esisteva in `calcolaSlotDisponibili`, aveva un test, e nessuna
-- delle quattro schermate che cercano slot lo passava -- quindi in produzione
-- valeva sempre 0. Codice che sembra vivo e non lo e'.
--
-- I default qui sotto sono esattamente il comportamento di oggi (15 / 0 /
-- griglia): applicare questa migrazione non cambia un singolo slot di nessun
-- salone finche' il titolare non tocca niente.

alter table tenants
  add column if not exists passo_slot_minuti int not null default 15,
  add column if not exists buffer_minuti int not null default 0,
  add column if not exists riempimento_agenda text not null default 'griglia';

-- Il passo sotto i 5 minuti genererebbe liste di slot illeggibili (e query
-- inutilmente grosse); sopra le 4 ore non e' piu' un passo, e' una fascia.
alter table tenants
  drop constraint if exists passo_slot_sensato;
alter table tenants
  add constraint passo_slot_sensato check (passo_slot_minuti between 5 and 240);

alter table tenants
  drop constraint if exists buffer_sensato;
alter table tenants
  add constraint buffer_sensato check (buffer_minuti between 0 and 240);

alter table tenants
  drop constraint if exists riempimento_agenda_valido;
alter table tenants
  add constraint riempimento_agenda_valido
  check (riempimento_agenda in ('griglia', 'attaccato'));

comment on column tenants.passo_slot_minuti is
  'Ogni quanti minuti viene proposto un orario libero. 15 = 09:00, 09:15, 09:30...';

comment on column tenants.buffer_minuti is
  'Minuti di stacco garantiti dopo ogni appuntamento (pulizia postazione, riordino). Valgono solo per proporre slot nuovi: non spostano gli appuntamenti gia'' presi.';

comment on column tenants.riempimento_agenda is
  'griglia = gli orari proposti restano allineati all''apertura (dopo un impegno che finisce alle 15:40 il primo slot e'' le 15:45). attaccato = il prossimo cliente attacca alla fine del precedente (15:40), si riempie di piu'' ma gli orari sono brutti.';

-- Il titolare modifica le proprie regole dalla dashboard: permesso sulle tre
-- colonne nuove, non sulla tabella (un grant di tabella riaprirebbe anche
-- piano, stato_abbonamento e gli id Stripe -- vedi 0030).
grant update (
  passo_slot_minuti,
  buffer_minuti,
  riempimento_agenda
) on public.tenants to authenticated;
