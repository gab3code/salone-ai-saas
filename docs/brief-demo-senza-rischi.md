# Brief: la demo che non ci può incasinare il sistema

Scritto da me il 17/09/2026 dopo l'obiezione di Gabriel, prima di toccare codice.
Serve a fissare il ragionamento mentre lo faccio, non dopo.

## L'obiezione, e perché è decisiva

> "verifica che non ci incasini il sistema... se il responsabile inizia ad usare la demo come
> vero salone diventa un problema serio... deve essere a tutti gli effetti una demo che eviti
> abusi e tutto il resto"

Ho costruito la demo come **tenant veri clonati**. Rileggendola con questa domanda in mano, ha
tre difetti che non avevo pesato abbastanza.

**1. Un clone è indistinguibile da un salone vero per tutto il resto del sistema.**
Ho dovuto escluderlo a mano dal pannello di piattaforma (il MRR contava 129,80 € mai incassati)
e dal giro notturno dei promemoria. Ma quelle sono le due cose che conoscevo **oggi**: ogni job,
ogni query, ogni metrica scritta da domani in poi dovrà ricordarsi di aggiungere
`.eq("e_demo", false)`. È una tassa permanente su ogni funzione futura, e prima o poi qualcuno
se la dimentica. Il costo non è quello che ho pagato: è quello che pagherò ogni volta.

**2. Qualcuno può usarla come salone vero, e il danno ricade sui suoi clienti.**
Non può entrare in dashboard (il clone non ha nessun utente), quindi non ci gestisce davvero
un'attività. Ma può prendere il link pubblico e darlo ai suoi clienti: quelli prenotano, l'AI
conferma, e **due giorni dopo la pulizia cancella tutto**. Gente che si presenta a un
appuntamento che non esiste più. Il fatto che sia autoinflitto non lo rende accettabile.

**3. È tanta superficie per una funzione di marketing.**
Due migrazioni, una funzione di clonazione, un cookie, un tetto giornaliero di cloni, una
pulizia, tre esclusioni sparse. Su un prodotto che non ha ancora incassato un euro.

## La decisione

**Rinuncio ai tenant.** La demo non scrive niente da nessuna parte: nessun tenant, nessun
appuntamento, nessun cliente, nessuna conversazione. L'agenda della demo vive **solo nella
sessione di chi la sta guardando**.

Non è la "demo grafica e basta" che Gabriel offriva come ripiego: l'assistente resta **vero**,
risponde davvero con il modello, e controlla davvero la disponibilità. Cambia solo dove stanno i
dati.

### Perché si può fare senza che diventi un secondo prodotto

`calcolaSlotDisponibili` in `src/lib/booking-engine.ts` è **logica pura**: prende orari,
operatori e appuntamenti come parametri e non sa niente di database. Quindi la demo può chiamare
**la stessa identica funzione** con dati finti. La disponibilità non è una copia che somiglia a
quella vera: è quella vera.

Questo è il punto che rende la scelta onesta invece che una scorciatoia. Se la logica di
disponibilità fosse sepolta dentro le query, una demo a dati finti sarebbe un secondo motore che
diverge — e allora avrebbe avuto ragione l'approccio a cloni.

## Cosa sparisce, e cosa ci guadagniamo

| | Cloni | Sessione |
|---|---|---|
| Uso improprio come salone vero | possibile, con danno ai suoi clienti | **impossibile: non esiste un link da dare a nessuno** |
| Righe scritte nel database | tenant, servizi, operatori, orari, appuntamenti, clienti, conversazioni | **nessuna** |
| Esclusioni da ricordare in futuro | una per ogni job/metrica nuovo | **nessuna** |
| Isolamento fra visitatori | un tenant a testa | **gratis: è lo stato della sessione** |
| Pulizia | giro notturno, cascata, tetto giornaliero | **nessuna: finisce la sessione, finisce tutto** |
| Costo | modello, con tetto | **modello, con tetto** |
| Disponibilità calcolata | dal motore vero | **dal motore vero (stessa funzione pura)** |

L'unica cosa che si perde: la prenotazione non sopravvive a un ricaricamento della pagina. Per
una demo è indifferente, e forse è meglio.

## Perimetro del lavoro

1. Smontare l'architettura a cloni: migrazione 0044 e i due saloni della 0042 non servono più.
   I tenant finti vanno cancellati dalla produzione, altrimenti restano raggiungibili a
   `/s/demo` e il problema 2 resta aperto.
2. I dati del salone finto diventano una costante nel codice.
3. Un esecutore di strumenti che lavora sulla costante e sull'agenda di sessione, che riusa
   `calcolaSlotDisponibili` invece di reimplementarla.
4. Un endpoint dedicato per la chat della demo, con:
   - tetto mensile globale (una riga in una tabella di contatori, non un tenant);
   - nessuno strumento che scriva fuori dalla sessione;
   - le stesse difese anti-abuso già esistenti dove hanno senso.
5. La pagina `/demo`: il salone finto disegnato staticamente, l'interruttore Growth/Pro, la chat.
6. Test sulla logica pura, che ora si può testare **senza database**.

## Il rischio residuo, dichiarato

Resta il costo del modello, ed è l'unico. Lo governa un tetto mensile globale. L'anti-burst per
IP resta un lavoro a parte, che riguarda tutto l'endpoint pubblico e non solo la demo.
