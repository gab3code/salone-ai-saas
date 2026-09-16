-- Fase 5 -- Registro degli interventi di piattaforma, e cancellazione di
-- un'attività che non travolge le persone.
--
-- Due cose nate insieme il 16/09/2026, perché servono l'una all'altra: dal
-- pannello admin si può cancellare un'attività, e ogni intervento manuale
-- lascia una traccia.

-- ---------------------------------------------------------------------
-- 1. profiles.tenant_id: da CASCADE a SET NULL
-- ---------------------------------------------------------------------
-- Dalla migrazione 0027 quella colonna non significa più "il tenant di
-- questo utente" ma "la sede attiva in questo momento", e da allora può
-- essere null. La cascata è rimasta indietro rispetto a quel cambio di
-- significato, e con la cancellazione di un'attività diventa un danno vero:
-- un titolare che possiede DUE saloni e in quel momento sta lavorando nel
-- primo, se il primo viene cancellato si vedrebbe cancellare anche il
-- profilo, perdendo l'accesso al secondo salone che è ancora suo.
--
-- SET NULL è la semantica giusta ora: sparisce la sede attiva, non la
-- persona. Chi resta senza sede non legge e non scrive nulla (ogni policy
-- confronta `tenant_id = null`, che non è mai vero) e al primo accesso
-- sceglie un'altra delle sue attività, se ne ha.
-- La cancellazione VERA dell'account di chi non fa più parte di niente resta
-- una decisione esplicita del codice, non un effetto collaterale di una
-- foreign key -- vedi `cancellaAttivita` in src/lib/admin.server.ts.
alter table profiles drop constraint profiles_tenant_id_fkey;
alter table profiles
  add constraint profiles_tenant_id_fkey
  foreign key (tenant_id) references tenants (id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. Sospensione di un'attività
-- ---------------------------------------------------------------------
-- Leva contrattuale, non tecnica: serve quando un cliente non paga da mesi,
-- o quando un'attività va fermata in fretta per un abuso segnalato, senza
-- dover arrivare alla cancellazione (che invece è irreversibile e cancella
-- anche i dati dei suoi clienti).
-- Un'attività sospesa smette di ACCETTARE prenotazioni dalla pagina
-- pubblica -- è l'unica cosa che fa davvero danno a un salone e l'unica leva
-- che serve -- mentre il titolare continua a entrare in dashboard, a vedere
-- la propria agenda e a capire cosa sta succedendo. Chiudergli fuori anche
-- quella significherebbe impedirgli di onorare gli appuntamenti già presi,
-- cioè punire i suoi clienti invece di lui.
alter table tenants
  add column sospesa boolean not null default false,
  add column sospesa_motivo text,
  add column sospesa_il timestamptz;

comment on column tenants.sospesa is
  'true = la pagina pubblica non accetta più prenotazioni. La dashboard resta accessibile al titolare, che deve poter onorare gli appuntamenti già presi.';

-- ---------------------------------------------------------------------
-- 3. Registro degli interventi
-- ---------------------------------------------------------------------
-- Il GDPR chiede di poter DIMOSTRARE quello che si fa sui dati altrui
-- (principio di responsabilizzazione, art. 5.2), e una cancellazione senza
-- traccia è esattamente ciò che non si riesce a dimostrare. Vale anche
-- senza scomodare la legge: fra sei mesi, davanti a un'attività su
-- Enterprise, serve sapere chi ce l'ha messa e quando.
create table interventi_admin (
  id uuid primary key default gen_random_uuid(),
  -- Chi ha agito. `set null` e non `cascade`: se un domani l'account admin
  -- venisse cancellato, il registro deve restare -- è il suo unico scopo.
  admin_user_id uuid references auth.users (id) on delete set null,
  admin_email text,

  -- NESSUNA foreign key verso tenants, di proposito. L'intervento più
  -- importante da registrare è proprio la cancellazione di un'attività: con
  -- una foreign key in cascata la riga di registro sparirebbe insieme a ciò
  -- che documenta, e con `set null` si perderebbe di quale attività si
  -- trattava. Per lo stesso motivo nome e slug sono copiati qui sotto e non
  -- letti in join: devono sopravvivere alla riga che descrivono.
  tenant_id uuid,
  tenant_nome text,
  tenant_slug text,

  azione text not null check (
    azione in (
      'piano_manuale',
      'ripristino_stripe',
      'sospensione',
      'riattivazione',
      'cancellazione_attivita'
    )
  ),
  -- Dettaglio libero per azione: il piano prima e dopo, quante righe sono
  -- state cancellate, l'esito della cancellazione dell'abbonamento Stripe.
  dettaglio jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index interventi_admin_tenant_idx on interventi_admin (tenant_id, created_at desc);
create index interventi_admin_data_idx on interventi_admin (created_at desc);

alter table interventi_admin enable row level security;

-- Nessuna policy: il registro non è leggibile né scrivibile da nessun utente
-- autenticato, nemmeno dall'admin col suo client normale. Ci arriva solo il
-- service_role, dal pannello, dopo aver verificato il ruolo di piattaforma.
-- Un titolare non deve vedere gli interventi fatti su altre attività, e
-- nessuno deve poter riscrivere il proprio registro.
grant select, insert on public.interventi_admin to service_role;
