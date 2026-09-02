# WhatsApp Embedded Signup -- preparazione per quando avrai la P.IVA

Obiettivo: il giorno che completi la business verification su Meta, collegare
WhatsApp per ogni nuovo salone deve essere "incolla due chiavi", non un lavoro
da fare da zero. Questo documento è la checklist esatta di cosa fare (in gran
parte cose tue, una tantum, non per ogni cliente) e cosa nel codice è già
pronto ad aspettare quelle chiavi.

Fonti ufficiali Meta consultate per scrivere questo documento (verificare se
è passato molto tempo: le versioni della Graph API cambiano):
- [Embedded Signup Overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [Embedded Signup Implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation)
- [Onboarding business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)

## Cosa devi fare TU, una volta sola per tutta la piattaforma (non per cliente)

1. **Business verification su Meta Business Suite** -- nome azienda, indirizzo,
   telefono, email, sito, con la P.IVA come prova legale dell'attività. Già
   discusso: da avviare appena hai la P.IVA.
2. **Creare un'app Meta di tipo Business** nel Meta App Dashboard (non
   "Consumer") -- diversa dall'eventuale app già usata nel progetto precedente,
   se quella non era di tipo Business.
3. **Configurare "Facebook Login for Business"**: creare una configurazione
   usando il template "WhatsApp Embedded Signup Configuration" (o una
   personalizzata selezionando solo WhatsApp), con i domini del sito
   (`NEXT_PUBLIC_SITE_URL`, da definire quando avremo un dominio vero) aggiunti
   sia a "Allowed domains" sia a "Valid OAuth redirect URIs". Da qui si ottiene
   il `CONFIGURATION_ID` da mettere in
   `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`.
4. **App Review**: richiedere accesso avanzato a due permessi --
   `whatsapp_business_management` e `whatsapp_business_messaging`. Meta chiede
   due video dimostrativi (invio messaggio, creazione template) -- prepareremo
   noi lo scenario di test quando siamo a questo punto, è lavoro nostro non
   solo tuo.
5. **Webhook della piattaforma**: configurare l'URL webhook (quando avremo un
   dominio) e il `WHATSAPP_VERIFY_TOKEN` (una stringa a scelta, generata da
   noi, serve solo alla verifica iniziale Meta del webhook).
6. Finché App Review non è approvata: fino a 10 clienti collegabili ogni 7
   giorni (limite di sviluppo Meta, non nostro) -- ampiamente sufficiente per
   i primi clienti reali, sale a 200/settimana dopo l'approvazione.

Nessuno di questi passaggi è per-cliente: si fanno una volta per la
piattaforma, poi ogni salone nuovo passa dal flusso automatico sotto.

## Cosa è già pronto nel codice, in attesa delle chiavi vere

- `supabase/migrations/0003_whatsapp_embedded_signup.sql`: colonne su
  `tenants` (`whatsapp_business_id`, `whatsapp_waba_id`, `whatsapp_stato`) +
  tabella separata `whatsapp_credenziali` per il token (RLS attiva SENZA
  policy: leggibile/scrivibile SOLO dal service_role lato server, mai
  dall'app del cliente -- un token WhatsApp è un segreto quanto una password)
  + `whatsapp_collegamento_log` per tracciare cosa è successo (utile per
  l'admin panel e per capire un collegamento fallito).
- `src/lib/whatsapp-embedded-signup.ts`: le tre chiamate server-side vere e
  documentate da Meta -- scambio codice→token, iscrizione della nostra app
  alla WABA del cliente (senza la quale non riceveremmo nessun messaggio),
  sincronizzazione storico/contatti per i saloni che migrano un numero già
  usato sull'app WhatsApp Business mobile (il caso "uso il telefono personale
  anche per il negozio" di cui avevamo già parlato).
- `src/app/api/whatsapp/embedded-signup/callback/route.ts`: la route che
  riceverà il risultato del flusso dal browser e lo completerà lato server.
  Disattivata di proposito (risponde 503) finché
  `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_ENABLED` non è `true`.

## Cosa manca ancora (da fare quando le chiavi sono reali, non prima)

- Il pulsante "Connetti WhatsApp" nelle impostazioni del salone (Fase 4 UI):
  carica l'SDK Facebook, apre `FB.login` con il `CONFIGURATION_ID`, e alla
  fine chiama la route sopra con `code`/`wabaId`/`phoneNumberId` ricevuti.
  Non ha senso costruirlo prima di avere un `CONFIGURATION_ID` vero da
  testare -- lo scriviamo quando arriviamo lì, ma tutta la parte server è
  già pronta ad aspettarlo.
- Collegare la route al vero client Supabase (service_role) per salvare
  token/stato -- oggi è solo un TODO commentato, aspetta il progetto
  Supabase reale (in corso).
- Test end-to-end del flusso con un numero WhatsApp vero, dopo l'App Review.

## Perché nel frattempo il prodotto non si blocca

Il canale di default resta la chat web (vedi
`docs/verifica-stack-automazione.md`): funziona da subito, stesso motore
AI/booking. WhatsApp si aggiunge sopra, per i saloni che lo vogliono, appena
questa checklist è chiusa -- senza dover riprogettare nulla, perché lo schema
e la logica server sono già pronti ad aspettarlo.
