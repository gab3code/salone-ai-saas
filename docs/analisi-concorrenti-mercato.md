# Mercato e concorrenti oltre Estetia (11/09/2026)

Estetia (`docs/analisi-estetia.md`) resta il concorrente diretto più vicino per posizionamento
(gestionale + AI conversazionale per saloni), ma NON è l'unico che fa "AI su WhatsApp per
prenotazioni di attività su appuntamento" -- ricerca fatta su segnalazione di Gabriel
dopo aver trovato altri nomi. Il mercato italiano di questa categoria specifica è più affollato
di quanto sembrasse, non "ampissimo e vuoto".

## Concorrenti diretti verificati (stessa categoria: AI + WhatsApp + booking)

### Calendix (calendix.it, prodotto di Nextt)
Il più simile a noi in assoluto, e già maturo:
- AI che legge i messaggi WhatsApp, propone slot liberi e conferma in ~2 secondi, 24/7.
- **Lista d'attesa intelligente**: a una cancellazione, avvisa automaticamente chi è in lista e
  assegna lo slot al primo che risponde -- funzionalità che NÉ noi NÉ Estetia abbiamo.
- **Marketing automatico su clienti inattivi** (assenti da 6+ settimane, offerte personalizzate
  automatiche) -- noi abbiamo solo l'insight "clienti inattivi" con link manuale, loro
  automatizzano l'azione stessa.
- Prezzi: Light 24€/mese (1 operatore, AI limitata ~100 risposte/mese), Pro 33€/mese (operatori
  illimitati, app mobile, marketing center), Business 74€/mese (multi-sede, account manager) --
  **più economico di Estetia su tutta la linea** e senza limite di operatori dal piano Pro in su.
- 30 giorni di prova gratis, garanzia rimborso 60 giorni, nessuna commissione sulle prenotazioni.
- Si posiziona ESPLICITAMENTE contro Treatwell, Fresha, WeGest, Cutapp sul proprio sito
  ("non un marketplace che ti rivende i tuoi clienti", "nessuna app che il cliente deve
  scaricare") -- quindi loro stessi considerano questi 4 concorrenti diretti, non noi ancora.

### Skedula (skedula.it)
Non è solo per officine auto (nome fuorviante) -- multi-verticale dichiarato: saloni/centri
estetici, officine, studi medici/fisioterapia, consulenti. Rilevante per noi:
- **Assistente AI che riconosce clienti da foto/voce** e crea appuntamenti/preventivi da solo.
- **Assistente vocale che gestisce le chiamate di prenotazione in autonomia, 24/7** -- questo è
  oltre quello che Estetia dichiara (loro parlano di gestione "anche vocale" delle conversazioni
  ma non di rispondere al telefono) e oltre il nostro piano attuale (Fase 2 è solo testo/chat).
  Se è vero e funzionante è il differenziale AI più avanzato visto finora in tutta la categoria.
- Prezzo fisso 690€/anno (~57,50€/mese), prova 15 giorni senza carta.

### Menzionati ma non ancora verificati dal vivo
Sagomapp (nessuna pagina trovata con questo nome esatto in questo giro di ricerca -- da
riverificare, potrebbe essere scritto diversamente o troppo di nicchia per indicizzazione),
Treatwell e Fresha (marketplace internazionali di prenotazione, modello diverso: loro portano
clienti nuovi ma trattengono il rapporto/commissione, non solo software B2B), WeGest, Cutapp
(gestionali italiani generalisti, presumibilmente senza AI conversazionale nativa come
differenziale primario -- da verificare se rilevante).

## Lettura onesta per Gabriel

L'idea che "pochissime persone le usano quindi il mercato è ampissimo" non regge al primo giro
di verifica: **Calendix e Skedula fanno già, oggi, in produzione, esattamente quello che
stiamo costruendo noi** (AI su WhatsApp che risponde, propone slot, conferma), con anni di
vantaggio, prezzi aggressivi e feature che noi non abbiamo ancora (lista d'attesa automatica,
marketing su inattivi, in un caso persino voce). Non è un mercato vuoto -- è un mercato con
diversi player italiani specializzati, oltre ai marketplace internazionali generalisti
(Treatwell/Fresha) che restano un pericolo diverso (portano volume ma "rubano" la relazione
col cliente finale, come nota bene Calendix stesso nel suo posizionamento).

Questo non significa che il progetto non abbia senso -- il mercato dei saloni in Italia è
enorme e nessuno di questi ha una quota dominante -- ma cambia la domanda strategica: non
"siamo tra i pochi a farlo", bensì "cosa facciamo meglio di Calendix e Skedula in particolare",
che sono i due concorrenti diretti più pericolosi trovati finora, più di Estetia stessa su
alcuni fronti (prezzo più basso di Calendix, feature vocale di Skedula).

## Cosa aggiungere alla lista "cosa dobbiamo fare meglio" (aggiornamento rispetto ad analisi-estetia.md)
1. **Lista d'attesa automatica alla cancellazione** (visto su Calendix, non su Estetia): quando
   un cliente cancella, proporre automaticamente lo slot al primo in coda invece di lasciarlo
   libero finché qualcuno non lo richiede attivamente. Nessun lavoro architetturale enorme sopra
   il booking engine che già abbiamo.
2. **Automazione reale sui clienti inattivi**, non solo insight passivo: un'azione schedulata
   (non solo un link "vedi i clienti inattivi") che invii davvero un messaggio/offerta.
3. **Valutare seriamente un canale vocale** (telefonate reali, non solo testo) come possibile
   differenziale a medio termine, se Skedula lo ha davvero in produzione -- richiede
   speech-to-text/text-to-speech e un provider telefonico (es. Twilio), fuori scope per ora ma
   da tenere in mente per non farci sorprendere.
4. Non sottovalutare il prezzo: Calendix parte da 24€/mese con AI inclusa fin dal piano più
   basso -- la nostra futura pagina prezzi deve reggere il confronto, non solo con Estetia.
