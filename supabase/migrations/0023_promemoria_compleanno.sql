-- Promemoria di compleanno (Fase 4/automazioni extra, Pro/Enterprise --
-- vedi Prezzi.tsx "Automazioni extra (promemoria di compleanno)"). Trovato
-- come CONFLITTO il 15/09/2026 durante la rilettura completa della
-- documentazione competitiva: la voce era pubblicizzata su Pro da prima del
-- 12/09/2026, ma il 15/09/2026 Gabriel aveva deciso di rimandarla a dopo il
-- lancio -- vedi DECISIONS.md per entrambe le date. Costruita adesso perché
-- lo stesso giorno, dopo la spiegazione del meccanismo, Gabriel ha risposto
-- "va bene ma rendi tutto personalizzabile dallo staff": questa migrazione
-- e il codice che la usa sono esattamente quella richiesta.
--
-- "Tutto personalizzabile dallo staff" qui significa: (1) un
-- interruttore acceso/spento per tenant (di default SPENTO -- un titolare
-- che non ha mai visitato le impostazioni non deve vedere partire email ai
-- suoi clienti senza averlo scelto, stesso principio già seguito per
-- l'automatico della lista d'attesa in PIANI_CON_LISTA_ATTESA_AUTOMATICA);
-- (2) il testo del messaggio è libero, scritto dallo staff con un
-- segnaposto `{nome}` sostituito dal nome del cliente -- non le opzioni
-- guidate del tono dell'AI (tono_ai), perché qui il messaggio va letto
-- parola per parola dal cliente finale, non è un'indicazione di stile per
-- un modello linguistico.

-- Data di nascita del cliente: colonna libera su `clienti`, non vincolata
-- al piano Pro -- raccoglierla è gratis (una colonna in più, nessun costo
-- di invio) ed è utile come dato CRM anche a chi non ha ancora il
-- promemoria attivo; è SOLO l'invio automatico più sotto a restare dietro
-- il gate di piano (pianoHaPromemoriaCompleanno in piani.ts). Nullable e
-- MAI obbligatoria: un dato personale sensibile che il cliente potrebbe non
-- voler lasciare, coerente con il resto della scheda cliente (email,
-- telefono, note sono già tutti facoltativi).
alter table clienti add column data_nascita date;

-- Claim-before-send per anno, stesso principio di
-- `promemoria_inattivita_inviato_at` (una singola colonna con
-- update-condizionato, non una tabella di tracciamento separata come
-- `promemoria_appuntamento_inviati` -- qui non serve un "per quale regola",
-- il compleanno è uno solo per cliente): memorizza l'ANNO (calendario
-- locale del tenant, non l'anno UTC) dell'ultimo invio, cosi' un secondo
-- giro del cron nello stesso giorno o un run manuale ripetuto non manda due
-- volte lo stesso augurio, e l'anno successivo il confronto torna
-- naturalmente idoneo senza dover azzerare nulla.
alter table clienti add column compleanno_ultimo_anno_avvisato integer;

-- Interruttore per tenant (default SPENTO, vedi sopra) e messaggio
-- personalizzabile. `compleanno_messaggio` NULL = usa il testo predefinito
-- (MESSAGGIO_COMPLEANNO_PREDEFINITO in src/lib/compleanno.ts) -- stesso
-- principio di tono_ai_nota: personalizzare è facoltativo, non
-- obbligatorio per usare la funzione. Limite di lunghezza generoso rispetto
-- a tono_ai_nota (300) perché qui il testo è l'intero messaggio che il
-- cliente legge, non una nota supplementare per l'AI.
alter table tenants
  add column compleanno_attivo boolean not null default false,
  add column compleanno_messaggio text check (compleanno_messaggio is null or char_length(compleanno_messaggio) <= 500);
