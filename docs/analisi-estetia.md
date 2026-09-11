# Analisi Estetia (estetia.tidycode.it)

Fonti: (a) giro dal vivo con browser reale sul sito marketing pubblico, RIFATTO per intero
l'11/09/2026 su richiesta esplicita di Gabriel per verificare che non manchi nulla -- homepage
completa, prezzi, FAQ, footer, accessibility tree con tutti gli elementi interattivi, nessuna
differenza sostanziale rispetto al giro precedente (stessi prezzi/feature/FAQ, vedi sezione
dedicata sotto per le poche aggiunte minori trovate); (b) screenshot reali del prodotto raccolti
in precedenza (onboarding, dashboard, analytics/clienti, calendario); (c) ricerca precedente su
posizionamento. Non ancora verificato dal vivo: il flusso di registrazione/onboarding reale
passo-passo (per non creare un account di test sul prodotto di un concorrente), l'app mobile/PWA,
il comportamento responsive del prodotto (solo del sito marketing). Prodotto costruito da
un'agenzia esterna, **Tidycode S.r.l.** (tidycode.it, +39 348 169 5382) -- non è detto che il
titolare del salone abbia margini di personalizzazione oltre quanto esposto nel pannello.

## Posizionamento e messaggio centrale
Tagline: "Il nuovo segreto di bellezza è un'agenda che lavora da sola." Claim distintivo non
ancora nei nostri 33 punti in questi termini: **"rispondendo in chiave anche vocale alle
conversazioni"** -- lascia intendere gestione di messaggi vocali (non solo testo) da parte
dell'AI. Da verificare quanto sia reale vs. copy aspirazionale, ma se reale è un differenziale
concreto (i clienti dei saloni spesso mandano vocali su WhatsApp) da valutare per la nostra
architettura tool-calling (Fase 2) -- come minimo va gestito lo speech-to-text del canale
WhatsApp prima di passare il testo all'AI.

## Onboarding (3 step dichiarati, copy homepage)
1. **Configura il salone** -- servizi, orari, operatori. "Estetia impara come lavori e si
   adatta al tuo modo di gestire il salone."
2. **Collega WhatsApp** -- "I tuoi clienti scrivono come sempre. Estetia risponde, propone slot
   e conferma. Se serve, passa la palla a te." Stesso principio AI+fallback umano già nel nostro
   piano (Fase 2).
3. **Guarda crescere il salone** -- dashboard con prenotazioni/clienti/revenue/performance.

Claim: "Attivo in 10 minuti. Zero competenze tecniche richieste." -- criterio di successo
esplicito e misurabile per il nostro onboarding (Fase 1/7): se il nostro richiede di più o
richiede scelte tecniche (es. capire cos'è un webhook), abbiamo perso questo confronto anche
se il resto è superiore.

## Gestione avanzata (funzionalità non ovvie, dalla homepage)
- **Servizi -> Attività -> Postazione**: ogni servizio mappa su un'"attività" (es. colore,
  taglio, cassa) e ogni attività su una postazione FISICA. "Estetia garantisce che due
  operatori non occupino mai la stessa sedia nello stesso momento." Questo è un livello di
  modellazione che il nostro schema attuale non ha: noi preveniamo conflitti per
  **operatore**, loro anche per **postazione/risorsa fisica** (una cassa, uno specchio, un
  lavabo condiviso da più operatori). Rilevante per saloni con team dove le postazioni sono
  meno numerose degli operatori. Da valutare se aggiungere un concetto opzionale di "risorsa"
  al booking engine (punto 12/13) -- non necessario per il salone individuale, utile per
  "salone con team".
- **Primo slot disponibile in un click** ("Walk-in"/"+ Aggiungi"): auto-scheduling che calcola
  il prima possibile dati orari operatori + postazioni occupate + durata servizio, senza calcoli
  manuali. La nostra `calcolaSlotDisponibili` già calcola slot liberi; manca la scorciatoia UI
  "trovami il prima possibile" a un click nel calendario -- da aggiungere in Fase 1 (vista
  calendario) come feature esplicita, non solo conseguenza implicita dell'API.
- **Pagina salone personalizzata**: vetrina pubblica con servizi/prezzi/foto/prenotazione
  diretta -- corrisponde al nostro punto 18/19 (Fase 4), confermato come atteso di base, non
  un extra.

## Dashboard (da screenshot prodotto reale)
KPI in alto: Chat del salone, Appuntamenti oggi, Appuntamenti settimana, Tasso AI (% di
conversazioni gestite senza intervento umano). Sotto: "Allocazione operatori - Oggi", vista a
gantt oraria per operatore con blocchi colorati per stato. Sidebar: Dashboard, Calendario,
Clienti, Cassa, Chat Salone, Team, Pagina Salone (Anteprima pubblica/Configurazione/Servizi/
Postazioni), Fallback, Notifiche, Impostazioni, **Prompt Lab** (editor del comportamento
dell'AI -- disponibile solo sul piano Pro secondo la pagina prezzi, add-on "AI personalizzata"
19,90€/mese sugli altri piani a pagamento).

## Servizi (da screenshot)
Catalogo con durata e prezzo (es. "Acconciatura Cerimonia · 60min · 70,00€"), raggruppabile per
categoria, associabile a più operatori/attività.

## Analytics / Clienti (CRM, da screenshot)
Tabella clienti: nome, telefono, tag, "livello", numero appuntamenti, ultima visita, "rischio"
(basso/medio/alto, presumibile stima di abbandono). Ricerca, filtri, export/import CSV,
aggiunta manuale.

## Calendario (da screenshot)
Vista giorno/settimana per operatore, blocchi colorati per tipo/stato. "Utilizzo piano" con
contatori (Clienti 36/5000, Appuntamenti/mese 17/3000) visibile direttamente dove il titolare
lavora, non nascosto in una pagina impostazioni -- buona pratica da replicare per il feature
gating tecnico (punto 23/24).

## Prenotazione pubblica lato cliente (da screenshot)
Flusso: Servizi -> Professionista -> Ora -> Conferma, riepilogo prezzo/durata a lato, un solo
pulsante "Continua".

## Prezzi -- dati completi e aggiornati (verificati dal vivo, non da ricerca)
| Piano | Prezzo | Operatori | Clienti | Appuntamenti/mese | In più |
|---|---|---|---|---|---|
| Free | 0€ per sempre | 1 | 100 | 100 | Calendario, pagina salone con prenotazione online, notifiche push. Nessuna carta richiesta. |
| Starter | 29,90€/mese | 2 | 400 | 300 | + Chat AI sul sito, cassa e magazzino, email transazionali |
| Growth ("più popolare") | 49,90€/mese | 5 | 1.500 | 1.000 | + Analytics/KPI, email brandizzata, reminder WhatsApp automatici |
| Pro | 89,90€/mese | 10 | 5.000 | 3.000 | + AI conversazionale su WhatsApp, SMS attivi, Prompt Lab |
| Enterprise | su preventivo | illimitati | illimitati | illimitati | AI su Instagram/Telegram, PWA brandizzata, on-premise, supporto dedicato |

**Add-on self-serve** (Starter/Growth/Pro, non su Free): operatore extra 6,90€/mese, AI
personalizzata 19,90€/mese, blocco 300 clienti extra 6,90€/mese, blocco 250 appuntamenti extra
6,90€/mese, pagina negozio avanzata (galleria/recensioni) 9,90€/mese. Il Free non ha add-on --
per crescere oltre i limiti Free l'unico passo è Starter (leva di conversione esplicita).

**Trial**: alla registrazione, 14 giorni di prova con tutte le funzioni Starter, senza carta.
Alla scadenza il salone NON perde nulla: ricade sul piano Free per sempre con i dati intatti
(zero rischio percepito per il titolare che si registra -- da replicare esattamente, è una
leva di conversione forte e onesta).

**Upgrade/downgrade**: dal pannello Abbonamento, immediati, addebito/credito pro-rata via
Stripe, condizionati al rientrare nei limiti del piano target -- pattern tecnico che conferma
il nostro piano di feature gating self-service (punto 23/24) è la strada giusta, non solo
un'ipotesi.

## FAQ pubbliche (rilevanti per copy e onboarding)
- "Devo essere bravo con la tecnologia? No. Il setup richiede 10 minuti... Se hai bisogno, il
  nostro team ti aiuta." -- loro hanno comunque un team umano di supporto come rete di
  sicurezza dietro il self-service puro; da tenere presente come aspettativa implicita
  dell'utente finale (noi non abbiamo team di supporto umano -- va compensato con onboarding
  ancora più a prova di errore e messaggi di errore chiarissimi).
- "I miei dati sono al sicuro? ... il server è in Europa e rispettiamo il GDPR." -- claim di
  base attesa dal mercato italiano, non un differenziale: verificare che la nostra region
  Supabase sia EU (da controllare in Fase 0/5, non rimandare a fine progetto).

## Debolezze reali osservate (punto 26)
- **Complessità della griglia prezzi**: 5 piani + 5 add-on indipendenti (20+ combinazioni) sono
  potenti ma cognitivamente pesanti per un titolare di salone non tecnico -- la stessa homepage
  deve spiegarli con una FAQ dedicata ("Cosa succede se supero i limiti?"). Rischio concreto di
  "paralisi da scelta" al momento dell'upgrade. Opportunità: la nostra pagina prezzi può vincere
  restando più leggibile (meno add-on orizzontali, o un calcolatore interattivo "quanti
  operatori/clienti ti servono?" che consiglia il piano giusto).
- **"Tasso AI" e "rischio cliente" come numeri secchi**: dagli screenshot non risulta un "perché"
  o un'azione consigliata accanto alla metrica -- un insight senza azione vale meno di un
  insight con un pulsante "contatta questo cliente ora" (punto 21, dashboard actionable).
- **Prompt Lab riservato a Pro/add-on**: personalizzare il tono dell'AI è probabilmente il
  bisogno più immediato di QUALSIASI salone dal giorno 1 (evitare risposte robotiche), non un
  lusso da piano alto -- possibile differenziale se lo offriamo, anche in forma limitata, già su
  Free/Starter, magari guidato a domande invece che prompt libero (più accessibile a chi non sa
  scrivere prompt).
- **Nessuna prova pubblica di gestione di casi limite**: niente su come l'AI si comporta con
  servizi consecutivi, operatore non specificato dal cliente, cancellazioni last-minute via
  chat, richieste ambigue -- questi restano da testare a fondo SOLO nel nostro prodotto (punto
  30), Estetia non li mostra nel marketing per confrontarli direttamente.
- **Dipendenza da agenzia esterna (Tidycode)**: il prodotto non sembra avere un self-service di
  personalizzazione del brand/dominio visibile nella homepage per i piani bassi (PWA brandizzata
  è Enterprise-only) -- se il nostro punto 20 (PWA) offre branding di base anche su piani più
  bassi, è un differenziale concreto e verificabile.
- **Nessun account "prova il prodotto senza registrarti"**: il link "Guarda come prenota l'AI"
  rimanda a una demo statica animata nella homepage stessa (chat + agenda finti, stati
  chat/slots/summary/confirmed), non a un ambiente sandbox reale interagibile -- se costruiamo
  una demo realmente cliccabile (dati finti ma vero prodotto, non un'animazione), è un
  differenziale di fiducia forte per chi valuta il prodotto prima di registrarsi.

## Cosa dobbiamo fare meglio, in concreto (punto 27)
1. Pagina prezzi più semplice da capire a colpo d'occhio (meno combinazioni percepite, anche se
   la logica sotto resta flessibile) mantenendo comunque add-on self-service granulari (buona
   idea da riprendere, punto 23/24).
2. Ogni metrica in dashboard accompagnata da un'azione consigliata, non solo un numero (punto
   21) -- differenziale diretto vs. "Tasso AI"/"rischio cliente" secchi osservati.
3. Personalizzazione minima del tono AI disponibile da subito (anche su Free/Starter), guidata
   a domande invece che prompt libero -- abbassa la barriera vs. il loro Prompt Lab riservato.
4. Onboarding cronometrato e testato per restare sotto i 10 minuti dichiarati da loro come
   riferimento, con zero terminologia tecnica.
5. Demo pubblica realmente interagibile (non solo animata) prima della registrazione, se
   fattibile senza esporre dati reali di nessun salone.
6. Valutare un concetto opzionale di "postazione/risorsa fisica" nel booking engine per i saloni
   con team, mancante nel nostro schema attuale (vedi sezione Gestione avanzata sopra).
7. Verificare esplicitamente la region EU del progetto Supabase, per poter dichiarare lo stesso
   claim GDPR/server-in-Europa con onestà.

## Rilettura dell'11/09/2026 -- conferme e poche aggiunte minori
Rifatto il giro completo della homepage (unica pagina pubblica indicizzata a parte le pagine
legali) dal vivo con browser reale. Prezzi, piani, add-on, FAQ, meccaniche di trial/upgrade:
**tutto confermato identico** a quanto già scritto sopra -- il progetto non aveva perso nessun
dettaglio sostanziale. Aggiunte minori trovate in questo giro, non presenti nella versione
precedente di questo documento:
- **"Fallback umano" è una delle 6 card di funzionalità in prima pagina** (Prenotazioni AI, CRM
  Clienti, Calendario smart, **Fallback umano**, Analytics, App mobile) -- non solo un principio
  citato nell'onboarding come scritto sopra, ma un differenziale che loro stessi vendono come
  feature a sé stante ("Richieste complesse? Estetia le mette in coda per te. Rispondi quando
  puoi, con tutto il contesto."). Il nostro Fase 2 ha lo stesso meccanismo (trasferimento a
  operatore) ma non lo presentiamo ancora come funzionalità di marketing a sé stante sulla
  pagina pubblica (Fase 4, quando esisterà).
- **Sezione "Per ogni tipo di salone"**: tre "persona" di marketing -- salone individuale (niente
  telefono mentre si lavora), salone con team (carico bilanciato, calendario condiviso), salone
  premium (esperienza cliente all'altezza). Segmentazione che noi non abbiamo ancora pensato per
  la pagina pubblica/marketing -- utile da riprendere in Fase 4 o in materiale commerciale, non
  richiede nessun lavoro tecnico.
- **Tre testimonianze clienti** (nome, ruolo, salone, città -- verosimilmente esempi illustrativi
  non verificabili) come prova sociale. Da considerare per la nostra pagina pubblica/landing una
  volta che avremo saloni reali disposti a farsi citare -- non urgente, non fattibile onestamente
  finché non abbiamo clienti reali.
- **Footer**: solo pagine legali oltre alla homepage (`/privacy-policy`, `/termini-servizio`,
  `/cookie-policy`, banner "Gestisci cookie"), contatti diretti dell'agenzia (telefono, email,
  tidycode.it) e tre social (Facebook, Instagram, LinkedIn) di Tidycode (non un profilo social
  dedicato al prodotto Estetia). **Nessun blog, nessuna pagina lavora-con-noi, nessuna pagina
  app-store/play-store trovata** -- conferma che è un sito marketing a una pagina, non un
  ecosistema di contenuti. Per noi: le pagine legali (privacy/termini/cookie) sono un gap reale
  da colmare prima del lancio pubblico (punto non ancora tracciato altrove in questo documento --
  vedi PROJECT_STATUS.md/PIANO.md, non risulta un problema noto aperto su questo).

**Conclusione di questo giro**: nessuna funzionalità o claim di Estetia risulta mancante dal
nostro piano che non fosse già stato individuato nel giro precedente (le sezioni "Debolezze
reali osservate" e "Cosa dobbiamo fare meglio" sopra restano valide e complete). Le uniche
aggiunte sono di marketing/copy (fallback umano come feature venduta, segmentazione per tipo di
salone, testimonianze), non di prodotto/tecnica, più un gap reale ma non di prodotto: le pagine
legali (privacy/termini/cookie), che a oggi il nostro progetto non ha.

## Ancora da verificare dal vivo (non fatto in questo giro, per non creare un account concorrente)
- Flusso di registrazione/onboarding reale passo-passo (schermate esatte, campi richiesti,
  eventuali attriti).
- Comportamento responsive del PRODOTTO (non solo del sito marketing) su mobile/tablet reali.
- App mobile: PWA installabile o app nativa? Notifiche push effettive.
- Comportamento reale dell'AI su richieste ambigue/multi-servizio/cancellazioni (impossibile da
  verificare senza un salone di test attivo -- il confronto vero si fa testando A FONDO il
  nostro prodotto sugli stessi scenari, punto 30).
