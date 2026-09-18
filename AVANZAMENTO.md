# Avanzamento

Fotografia al **18/09/2026, mattina** (aggiornata a fine nottata). Conta le
caselle di `PIANO.md` e dice, fase per fase, cosa manca davvero. Non
sostituisce il PIANO: lo riassume per poterci ragionare sopra senza rileggere
duemila righe.

Regola di lettura: **"aperte" non vuol dire "da fare adesso"**. Delle 54 voci
aperte, 20 sono bloccate dalla partita IVA e non dipendono da una riga di
codice.

Seconda regola, meno comoda: **il numero delle aperte puo' salire**. Stanotte
e' salito di una, pur avendone chiuse tre, perche' due voci nuove sono nate
dagli errori commessi mentre lavoravamo. Un elenco che scende sempre non e'
un elenco onesto, e' un elenco che non guarda.

---

## Il quadro in una tabella

| Fase | Cosa copre | Fatte | Aperte | Stato |
|---|---|---|---|---|
| 0 | Fondamenta | 8 / 8 | 0 | **chiusa** |
| 1 | Booking engine | 8 / 8 | 0 | **chiusa** (16/09) |
| 2 | AI conversazionale | 7 / 9 | 2 | quasi chiusa |
| 3 | CRM e dashboard | 9 / 9 | 0 | **chiusa** (17/09) |
| 4 | Pagina pubblica, foto, PWA | 9 / 9 | 0 | **chiusa** |
| 5 | Billing self-service e admin | 12 / 12 | 0 | **chiusa** (17/09) |
| 6 | Automazioni e sicurezza | 8 / 16 | 8 | in corso |
| 6bis | Calendari esterni | 5 / 7 | 2 | quasi chiusa |
| 6ter | Quello che serve per vendere | 4 / 38 | 34 | il grosso del lavoro |
| 7 | Estetica e responsive | 2 / 10 | 8 | non iniziata |

Non esistono fasi oltre la 7.

---

## Fase 2 -- AI conversazionale (2 aperte)

- Contesto persistente in `conversazioni.slot_in_costruzione`: la colonna
  esiste dalla 0001 e non viene usata. Oggi il contesto sta nello storico dei
  messaggi e funziona, quindi e' piu' una pulizia che una mancanza.
- Webhook WhatsApp/Telegram verso lo stesso motore. Bloccato dalla verifica
  business Meta, che a sua volta vuole la P.IVA.

## Fase 6 -- Automazioni e sicurezza (8 aperte)

Delle cinque di sicurezza, **due sono state chiuse il 18/09**:

1. L'invito che si consumava prima della conferma dell'email (migrazione 0050,
   Scenario 29). Era l'unica sfruttabile da un estraneo -- bastava indovinare
   l'indirizzo invitato.
2. La rubrica clienti scaricabile via PostgREST (migrazione 0051). Non era
   chiudibile con una policy: "puo' leggere le righe del suo tenant" e "puo'
   scaricarle tutte" sono la stessa query, e la differenza vive nel
   comportamento, non nei dati. Chiusa togliendo il permesso ad
   `authenticated` -- titolare compreso -- e facendo passare ogni accesso da
   `src/lib/clienti.server.ts` col client admin. Il prezzo e' che dentro quel
   file la rete di RLS non c'e' piu': per questo tutte le query stanno in un
   file solo e un test (`clienti.server.test.ts`) verifica il filtro sul
   tenant su OGNI funzione esportata, e fallisce anche solo se qualcuno ne
   aggiunge una nuova senza il suo test.

Le tre che restano richiedono tutte le credenziali di qualcuno gia' dentro
l'attivita', e sono dichiarate nel PIANO, non nascoste.

- Password CalDAV e refresh token Google leggibili da qualunque membro, e non
  revocati quando un membro viene rimosso. Va fatta insieme al cifraggio a
  riposo (Fase 6bis).
- Ridare al cliente l'autonomia in chat in modo sicuro (link di gestione
  mandato al suo numero, mai mostrato in chat). Dipende dagli SMS, quindi
  dalla P.IVA.
- Sospendere un'attivita' non tocca Stripe: continua a pagare il piano pieno.
  Forse voluto, ma va reso esplicito.

**Sentry e' stata chiusa il 18/09** (vedi in fondo): un errore in produzione
adesso lo sa qualcuno.

Le altre, non di sicurezza:

- Pacchetti prepagati / tessera fedelta' digitale.
- PostHog (analytics di utilizzo). Molto piu' in la'.
- La voce generica "revisione sicurezza" resta aperta perche' e' un processo,
  non un compito: l'ultima e' del 17/09 e ha prodotto la 0030.
- **NUOVA (18/09): un comando che confronti i permessi VIVI del database con
  quelli che le migrazioni dichiarano.** Stanotte lo stesso errore e'
  successo due volte in direzioni opposte: la 0030 era una revoca che
  esisteva solo in produzione e in nessun file; la 0051 era in un file e nel
  database di test, ma in produzione no -- per ore, con il codice gia' online
  e il prodotto che funzionava benissimo, perche' quel permesso non lo usa
  piu' nessuno. Nessun test puo' accorgersene: i test girano sul database di
  test, che era giusto. Serve un confronto esplicito, ed e' mezz'ora di
  lavoro che toglie di mezzo un'intera classe di errori silenziosi.

## Fase 6bis -- Calendari esterni (2 aperte)

- Direzione export (gli appuntamenti del salone nel calendario personale).
- Cifratura a riposo delle credenziali dei calendari: si lega alla seconda
  voce di sicurezza qui sopra.

## Fase 6ter -- Quello che serve per vendere (33 aperte)

**Bloccate dalla P.IVA: 20 voci.** Tutta l'attivazione Stripe in live (prezzi,
chiavi, webhook, metodi di pagamento, Connect per le caparre, contestazioni,
un pagamento vero di prova), la fatturazione elettronica allo SdI e la
verifica business Meta. Non c'e' niente da programmare finche' non arriva.

**Fattibili adesso, in ordine di quanto spostano:**

1. **Import della rubrica clienti, assistito dall'AI.** Dichiarata nel PIANO
   come "la funzione piu' importante che manca". Un salone che apre il
   gestionale e lo trova vuoto il primo giorno non lo usa il secondo.
2. **Voci di Pro senza codice** ("supporto prioritario", "report avanzati"):
   il listino le promette, il prodotto non le fa. O si costruiscono o si
   tolgono. Non e' un bug, e' una promessa.
3. **Verificare il backup del database.** Mai fatto. Finche' i dati sono di
   Gabriel e' un fastidio; dal primo salone sono i dati dei SUOI clienti, e
   l'accordo sul trattamento impegna formalmente a proteggerli.
4. **Email "la tua prova sta per scadere".** Il trial di 10 giorni oggi
   finisce in silenzio: il primo segnale che il salone riceve e' un addebito.
5. **Recupero dei clienti fermi** e **riempire i buchi dell'agenda**: le due
   leve che usano i dati che il prodotto gia' ha.
5bis. **NUOVA (18/09): "cambia password" dentro la dashboard.** Oggi non
   esiste: un titolare che vuole cambiarla deve passare da "password
   dimenticata", cioe' da una procedura pensata per chi non riesce piu' a
   entrare. Funziona, ma e' la porta sbagliata per una cosa ordinaria, e la
   prima volta che un salone lo chiede la risposta non puo' essere "esci e
   fai finta di averla persa".
6. **Note vocali che diventano scheda cliente** (un parrucchiere non digita).
7. **Bozze di risposta alle recensioni.**
8. **Segnali sulla dashboard del salone.**
9. **Video di sessanta secondi**: ora che la demo esiste e' una registrazione
   di schermo, non una produzione.
10. **La conferma che il cliente vedrebbe, mostrata nella demo.**

## Fase 7 -- Estetica e responsive (8 aperte)

Non iniziata. La direzione colore e' gia' stata scelta il 16/09 (verde
smeraldo) e aspetta solo di essere implementata. Dentro ci sono anche il
design system applicato ovunque, il responsive provato davvero su tre fasce,
la PWA rifinita, il confronto schermata per schermata con Estetia, la passata
sulle performance percepite, e il calendario di disponibilita' nella
prenotazione pubblica.

Vuole ore davanti, non ritagli.

---

## Chiuso il 17 e 18/09, oltre alle caselle del PIANO

Cose fatte in queste due giornate che non hanno una casella propria:

- **Recupero password**: non esisteva. Era l'unica voce dell'audit marcata
  "deve esistere prima del primo cliente pagante".
- **Limiti per IP su tutto l'uso dell'AI**, e tetti rivisti con contatore in
  dashboard e avviso all'80%.
- **Demo pubblica** senza tenant, con tetto mensile per connessione.
- **L'assistente non chiede piu' di ripetere un insulto** (prompt + rete
  deterministica sotto).
- **Database di test separato** da produzione, con guardia che impedisce alla
  suite di partire contro il database vero.
- **Migrazione 0049**: le revoche dei permessi esistevano solo in produzione e
  in nessun file. Ricostruendo il database dal repo, `anon` sarebbe nato con
  scrittura su tutte le tabelle.
- **Tre bug veri corretti**, due dei quali erano gia' in produzione: le Server
  Action del calendario (assenza, cancellazione e spostamento rotti in
  silenzio) e il registro interventi che perdeva il cambio piano con Stripe.

### La nottata del 18/09

- **Migrazione 0052 -- niente autopromozione ad admin.** Su `profiles` il
  ruolo `authenticated` poteva scrivere la colonna `ruolo`, quella che decide
  chi comanda su TUTTA la piattaforma. Non era sfruttabile, e il perche'
  conta: a fermarlo non era una decisione, era l'assenza di una policy di
  UPDATE. Sarebbe bastato che qualcuno ne aggiungesse una per una cosa banale
  ("l'utente puo' cambiare il proprio nome") e l'autopromozione si sarebbe
  aperta nello stesso istante, senza che nessuno la stesse guardando.
  Permesso revocato, test nello Scenario 23.
- **Sentry, con un filtro scritto a mano.** Non la procedura guidata: i loro
  valori predefiniti accendono il Session Replay, che registra lo schermo --
  qui vuol dire la rubrica di un salone. Ogni segnalazione passa da
  `sentry-riservatezza.ts` (12 test) che toglie email, telefoni, termini di
  ricerca (sono nomi di clienti), cookie di sessione e corpo dei moduli, e
  tiene percorso e id. Regione dati europea (Francoforte). Sentry elencato fra
  i fornitori nell'informativa privacy. Bottone di verifica in /admin, perche'
  una diagnostica rotta non da' nessun segno.
- **Il calendario, tre difetti trovati usandolo e non leggendolo.** "Nessuno
  slot libero per questa combinazione" nascondeva la causa vera (un servizio
  senza operatore assegnato) e proponeva tre rimedi tutti sbagliati: venti
  minuti persi a cercare dalla parte opposta. Ora dice il motivo, in ordine di
  precedenza, con il link al posto giusto. Il giorno guardato e il giorno per
  cui si prenota sono tornati due cose distinte. E la data si legge
  "venerdi' 18 settembre 2026", non "2026-09-18".
- **Prestazioni.** Le funzioni Vercel giravano a Washington con il database in
  Irlanda: ogni pagina pagava l'Atlantico cinque volte. Spostate a Dublino,
  accanto al database. Aggiunti i `loading.tsx`, che prima non esistevano in
  nessuna sezione, e convertiti 43 link interni da `<a>` a `Link` -- cinque
  lasciati apposta com'erano, a partire dall'export CSV, che con `Link` non
  scaricherebbe piu' niente.
- **Due difetti nei test stessi.** Gli scenari 23 e 26 creavano il salone di
  prova nel database di test e poi facevano il login in PRODUZIONE, perche' si
  costruivano il client a mano leggendo `.env.local`: fallivano con "Invalid
  login credentials", che fa pensare alla password e invece era l'indirizzo.
  E l'esclusione di vitest era `tests/e2e/**`, che portava via anche un file
  di test scritto il giorno prima e mai eseguito nemmeno una volta. Entrambi
  hanno adesso una guardia che li fa fallire se tornano.
- **Suite E2E a 62 scenari**, tutti verdi. 824 test unitari.

---

## Il percorso critico, se serve una risposta sola

La P.IVA sblocca 20 voci e non dipende da noi. Nel frattempo, le tre cose che
cambiano davvero qualcosa sono: **l'import della rubrica** (senza, il prodotto
e' vuoto il primo giorno), **il backup verificato** (senza, un incidente e'
definitivo) e **le voci di Pro** (senza, il listino promette cose che non
esistono).

Prima di quelle tre, mezz'ora: **il confronto fra permessi vivi e migrazioni**.
Non sposta niente per un salone, ma stanotte la stessa svista e' costata due
incidenti, e finche' non esiste ogni migrazione di sicurezza va verificata a
mano -- cioe' prima o poi non verra' verificata.

La Fase 7 e' la piu' visibile e la meno urgente: un salone non compra per il
colore, ma non resta se il gestionale e' vuoto.
