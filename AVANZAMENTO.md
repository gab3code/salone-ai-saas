# Avanzamento

Fotografia al **18/09/2026**. Conta le caselle di `PIANO.md` e dice, fase per
fase, cosa manca davvero. Non sostituisce il PIANO: lo riassume per poterci
ragionare sopra senza rileggere duemila righe.

Regola di lettura: **"aperte" non vuol dire "da fare adesso"**. Delle 53 voci
aperte, 20 sono bloccate dalla partita IVA e non dipendono da una riga di
codice.

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
| 6 | Automazioni e sicurezza | 7 / 15 | 8 | in corso |
| 6bis | Calendari esterni | 5 / 7 | 2 | quasi chiusa |
| 6ter | Quello che serve per vendere | 4 / 37 | 33 | il grosso del lavoro |
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

Le altre quattro:

- Pacchetti prepagati / tessera fedelta' digitale.
- Sentry (error tracking). Oggi un errore in produzione non lo sa nessuno.
- PostHog (analytics di utilizzo). Molto piu' in la'.
- La voce generica "revisione sicurezza" resta aperta perche' e' un processo,
  non un compito: l'ultima e' del 17/09 e ha prodotto la 0030.

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
- **Suite E2E a 55 scenari**, tutti verdi.

---

## Il percorso critico, se serve una risposta sola

La P.IVA sblocca 20 voci e non dipende da noi. Nel frattempo, le tre cose che
cambiano davvero qualcosa sono: **l'import della rubrica** (senza, il prodotto
e' vuoto il primo giorno), **il backup verificato** (senza, un incidente e'
definitivo) e **le voci di Pro** (senza, il listino promette cose che non
esistono).

La Fase 7 e' la piu' visibile e la meno urgente: un salone non compra per il
colore, ma non resta se il gestionale e' vuoto.
