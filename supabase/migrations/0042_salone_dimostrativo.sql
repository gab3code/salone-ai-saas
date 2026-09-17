-- 0042 -- Il salone dimostrativo (Fase 6ter, 17/09/2026)
--
-- "Non esiste un solo cliente vero da mostrare e la landing promette senza
-- provare." Da qui: un salone finto a un indirizzo fisso, che chiunque puo'
-- aprire e provare a prenotare davvero, parlando con l'assistente vero.
--
-- DUE saloni e non uno (scelta di Gabriel del 17/09/2026): lo stesso identico
-- salone su Growth e su Pro, con un interruttore per passare dall'uno
-- all'altro. La differenza fra i due piani smette di essere una riga in una
-- tabella prezzi e diventa una cosa che si prova: su Growth l'assistente
-- prenota, su Pro risponde anche a "dove parcheggio" e "fate il colore
-- vegetale". E' anche il miglior argomento di vendita per Pro che abbiamo.
--
-- I dati sono verosimili ma inventati. Nessun nome di persona reale (solo
-- nomi di battesimo), nessuna via esistente scelta apposta, e soprattutto
-- NESSUN NUMERO DI TELEFONO: un numero inventato appartiene quasi sempre a
-- qualcuno, e la pagina pubblica lo mostrerebbe a tutti. Il costo di questa
-- scelta e' che nella demo non si vede il passaggio "chiama il salone" --
-- l'assistente dira' genericamente di contattare l'attivita'. Se un giorno
-- si vorra' mostrare anche quello, va messo un numero che Gabriel controlla
-- davvero, non uno inventato.
--
-- Nessuna recensione finta di proposito: servirebbero appuntamenti e clienti
-- finti (una recensione e' legata a un appuntamento), e quelli finirebbero
-- sotto la scopa della pulizia automatica dei dati lasciati dai visitatori.
-- Meno finzione e una regola di pulizia semplice valgono piu' di due stelline
-- a schermo.

alter table tenants
  add column e_demo boolean not null default false;

comment on column tenants.e_demo is
  'true = salone dimostrativo pubblico. Governa il tetto AI, il divieto di invii reali e la pulizia dei dati lasciati dai visitatori. Nessun grant update: non deve poterla accendere nessuno dall''applicazione.';

-- Indice parziale: i due tenant demo si cercano a ogni richiesta della
-- pagina pubblica e del giro di pulizia, e sono due righe su tutta la tabella.
create index tenants_demo_idx on tenants (id) where e_demo;

-- ---------------------------------------------------------------------
-- I due saloni
-- ---------------------------------------------------------------------
insert into tenants (
  slug, nome, descrizione, indirizzo, piano, stato_abbonamento, e_demo,
  fuso_orario, ore_minime_cancellazione, caparra_attiva,
  notifica_titolare_nuova_prenotazione, follow_up_inattivi_attivo,
  raccolta_recensioni_attiva, piano_manuale
)
values
  (
    'demo', 'Atelier Camelia', 
    'Parrucchiere e centro estetico nel cuore del quartiere. Taglio, colore e trattamenti su misura, senza fretta.',
    'Via delle Camelie 7, Milano',
    'growth', 'attivo', true,
    'Europe/Rome', 24, false,
    false, false,
    false, true
  ),
  (
    'demo-pro', 'Atelier Camelia',
    'Parrucchiere e centro estetico nel cuore del quartiere. Taglio, colore e trattamenti su misura, senza fretta.',
    'Via delle Camelie 7, Milano',
    'pro', 'attivo', true,
    'Europe/Rome', 24, false,
    false, false,
    false, true
  );

-- Su Pro l'assistente ha anche la knowledge base: queste sono le colonne che
-- il tool `info_attivita` legge davvero (vedi tools.ts), piu' le FAQ sotto.
update tenants set
  parcheggio = 'Parcheggio libero in Via delle Camelie e posteggio a pagamento in piazza, a due minuti a piedi.',
  metodi_pagamento = 'Carte, bancomat, contanti e satispay.',
  tono_ai = 'amichevole'
where slug = 'demo-pro';

-- ---------------------------------------------------------------------
-- Orari: chiuso domenica e lunedi' (come quasi ogni parrucchiere),
-- 09:00-19:00 con pausa 13:00-14:00. giorno_settimana: 0 = domenica.
-- ---------------------------------------------------------------------
insert into orari_apertura (tenant_id, giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine)
select t.id, g.giorno,
       g.giorno in (0, 1),
       case when g.giorno in (0, 1) then null else time '09:00' end,
       case when g.giorno in (0, 1) then null else time '19:00' end,
       case when g.giorno in (0, 1) then null else time '13:00' end,
       case when g.giorno in (0, 1) then null else time '14:00' end
from tenants t
cross join (select generate_series(0, 6) as giorno) g
where t.e_demo
on conflict (tenant_id, giorno_settimana) do update set
  chiuso = excluded.chiuso,
  apertura = excluded.apertura,
  chiusura = excluded.chiusura,
  pausa_inizio = excluded.pausa_inizio,
  pausa_fine = excluded.pausa_fine;

-- ---------------------------------------------------------------------
-- Servizi e operatori
-- ---------------------------------------------------------------------
insert into servizi (tenant_id, nome, descrizione, categoria, durata_minuti, prezzo_centesimi)
select t.id, s.nome, s.descrizione, s.categoria, s.durata, s.prezzo
from tenants t
cross join (values
  ('Taglio donna',   'Consulenza, lavaggio, taglio e piega.',            'Capelli', 45, 3500),
  ('Piega',          'Lavaggio e messa in piega.',                       'Capelli', 30, 2000),
  ('Colore',         'Colorazione completa con trattamento finale.',     'Capelli', 90, 6500),
  ('Taglio uomo',    'Taglio e sistemazione, lavaggio incluso.',         'Capelli', 30, 2000),
  ('Barba',          'Rifinitura barba con panno caldo.',                'Barba',   20, 1500),
  ('Manicure',       'Limatura, cura delle cuticole e smalto.',          'Mani',    45, 2500)
) as s(nome, descrizione, categoria, durata, prezzo)
where t.e_demo;

insert into operatori (tenant_id, nome, ruolo)
select t.id, o.nome, o.ruolo
from tenants t
cross join (values
  ('Giulia', 'Colorista'),
  ('Marta',  'Parrucchiera'),
  ('Luca',   'Barbiere')
) as o(nome, ruolo)
where t.e_demo;

-- Chi fa cosa: Giulia e Marta sui capelli e le mani, Luca su uomo e barba.
-- Serve a far vedere che l'assistente propone l'operatore GIUSTO e non uno a
-- caso -- se sapessero fare tutti tutto, quella capacita' resterebbe invisibile.
insert into operatori_servizi (operatore_id, servizio_id)
select o.id, s.id
from operatori o
join servizi s on s.tenant_id = o.tenant_id
join tenants t on t.id = o.tenant_id
where t.e_demo
  and (
    (o.nome in ('Giulia', 'Marta') and s.nome in ('Taglio donna', 'Piega', 'Colore', 'Manicure'))
    or (o.nome = 'Luca' and s.nome in ('Taglio uomo', 'Barba'))
  );

-- ---------------------------------------------------------------------
-- Le FAQ che solo il salone Pro puo' usare
-- ---------------------------------------------------------------------
insert into faq_attivita (tenant_id, domanda, risposta)
select t.id, f.domanda, f.risposta
from tenants t
cross join (values
  ('Fate il colore vegetale?',
   'Sì, lavoriamo con una linea di colore senza ammoniaca a base vegetale. Va prenotato come Colore: la durata è la stessa, il prezzo è di 10 euro in più.'),
  ('Posso venire con un bambino?',
   'Certo. Abbiamo un seggiolone rialzato per il taglio dei più piccoli e nessun supplemento sotto i dieci anni.'),
  ('Quanto dura un colore completo?',
   'Circa un''ora e mezza, comprese posa e piega finale. Se è il primo colore da noi aggiungiamo dieci minuti di consulenza.'),
  ('Siete accessibili con la carrozzina?',
   'Sì, l''ingresso è a livello strada e il salone è tutto su un piano.'),
  ('Cosa succede se devo disdire?',
   'Basta disdire almeno 24 ore prima, dal link che ricevi nella conferma. Sotto le 24 ore ti chiediamo di chiamarci.')
) as f(domanda, risposta)
where t.slug = 'demo-pro';
