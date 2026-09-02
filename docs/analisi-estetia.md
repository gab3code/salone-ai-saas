# Analisi Estetia (estetia.tidycode.it)

Base per il reverse engineering richiesto. Fonti: screenshot reali del prodotto (onboarding,
dashboard, analytics/clienti, calendario) + ricerca su prezzi/posizionamento pubblici.
Non ho ancora navigato dal vivo ogni schermata interagibile (impostazioni, pagina pubblica
di un salone reale, dettaglio conversazione AI) -- se vuoi che completi quella parte con un
giro di browser automation dedicato, dimmelo e lo faccio come primo step della Fase 0/1.

## Onboarding (3 step dichiarati)
1. **Configura salone** -- inserimento servizi, orari, operatori. Copy: "Estetia impara come
   lavori e si adatta al tuo modo di gestire il salone" (implica che l'onboarding raccoglie
   dati strutturati che alimentano poi sia il calendario sia il prompt dell'AI).
2. **Collega WhatsApp** -- "I tuoi clienti scrivono come sempre. Estetia risponde, propone
   slot e conferma. Se serve, passa la palla a te." Stesso principio del nostro bot attuale:
   AI con fallback a operatore umano.
3. **Guarda crescere il salone** -- dashboard con prenotazioni/clienti/revenue/performance.

## Dashboard (schermata reale)
KPI in alto: Chat del salone, Appuntamenti oggi, Appuntamenti settimana, Tasso AI (% di
conversazioni gestite senza intervento umano, presumibilmente). Sotto: "Allocazione operatori
- Oggi", vista a gantt oraria per operatore con blocchi colorati per stato (assegnato, in
attesa, cancellato...). Sidebar: Dashboard, Calendario, Clienti, Cassa, Chat Salone, Team,
Pagina Salone (con sotto-voci Anteprima pubblica/Configurazione/Servizi/Postazioni), Fallback,
Notifiche, Impostazioni, Prompt Lab (probabile editor del prompt/comportamento dell'AI --
punto di forza da eguagliare: dare al titolare controllo sul tono senza scrivere codice).

## Servizi
Catalogo servizi con durata e prezzo (es. "Acconciatura Cerimonia · 60min · 70,00€"),
raggruppabili per categoria, ciascuno associabile a operatori/attività multiple ("2 attività").

## Analytics / Clienti (CRM)
Tabella clienti con: nome, telefono, tag, "livello", numero appuntamenti, ultima visita,
"rischio" (basso/medio/alto -- probabile stima di abbandono basata su ricorrenza). Ricerca,
filtri, export/import CSV, aggiunta manuale cliente.

## Calendario
Vista giorno/settimana con colonne per operatore, blocchi appuntamento colorati per tipo/stato
(es. arancione = walk-in, viola = servizio prenotato, verde/rosa = altri stati, tratteggiato
= annullato). Pulsanti rapidi "Walk-in" e "+ Aggiungi". In fondo: "Utilizzo piano" con contatori
espliciti (Clienti 36/5000, Appuntamenti/mese 17/3000) -- il limite del piano è visibile
direttamente dove il titolare lavora, non nascosto in una pagina impostazioni: buona pratica
da replicare per il feature gating (punto 23).

## Prenotazione pubblica (lato cliente finale)
Flusso: Servizi -> Professionista -> Ora -> Conferma, con riepilogo prezzo/durata a lato e
un solo pulsante "Continua" -- pochissimi click, coerente con "ridurre click e tempo" (punto 25).

## App mobile
Rivendicata come funzionalità primaria ("Accedi da smartphone, ovunque e controlla il salone
sempre da remoto"), non solo un sito responsive -- confermando che vale la pena trattarla
come PWA vera (punto 20), non come rifinitura finale.

## Pricing (da ricerca pubblica, verificare aggiornamento)
Free, poi tre fasce a pagamento (~29,90€ / ~49,90€ / ~89,90€ al mese) più Enterprise su
misura -- il Free è multi-canale (WhatsApp + Telegram + web chat) fin da subito, non solo
una demo limitata: è una barra alta per il nostro piano gratuito (punto 23).

## Debolezze/ipotesi da verificare dal vivo (punto 26)
- "Tasso AI" e "rischio cliente" sono metriche interessanti ma non sappiamo quanto siano
  spiegate/actionable nell'interfaccia reale (un numero secco senza "perché" e "cosa faccio
  ora" vale meno di un insight con azione, vedi punto 21).
- Non è chiaro dagli screenshot se il "Prompt Lab" dia davvero controllo utile a un titolare
  non tecnico o sia un campo di testo libero intimidatorio -- un'opportunità se lo rendiamo
  più guidato (domande, non prompt-engineering).
- Nessuna prova visibile di gestione di casi limite (slot che si libera, servizi consecutivi,
  cliente che cancella via chat) -- vanno testati dal vivo prima di assumere che li gestiscano
  bene.
