# Stato del progetto

Ultimo aggiornamento: 13/09/2026, dodicesimo giro -- Gabriel ha confermato "ancora niente" dopo il
giro precedente: nessuna delle due email del test è arrivata, nonostante i log Vercel non
mostrassero errori. Trovata la causa reale controllando direttamente la dashboard Mailjet (accesso
autorizzato da Gabriel, "usa anche mailjet se vuoi"): **Stats -> 0 email totali negli ultimi 7
giorni sul sub-account giusto** ("salone-ai-saas", verificato incrociando il prefisso della API Key
con quello citato nella notifica Mailjet ricevuta in precedenza) -- Mailjet non ha mai processato
nessun invio per questo progetto. La causa: in **Account -> Domains and senders**, il mittente
`gabrielmazzucchelli3@gmail.com` risulta ancora **Status: Pending**, non validato, nonostante
Gabriel avesse detto in precedenza "comunque l'ho autenticata". Quindi il fix del giro precedente
(l'enum rotto dal bundling) resta corretto e necessario, ma non è mai stato l'unico problema: senza
un mittente validato, Mailjet accetta comunque la richiesta HTTP con `Status: "success"` (per questo
il nostro codice non logga nessun errore -- fail-open che qui nasconde un problema reale, vedi nota
sotto) ma probabilmente mette l'invio in una coda di attesa e non lo consegna mai, e infatti non
compare da nessuna parte nelle statistiche Mailjet (nessun Queued/Delivered/Blocked). **Serve che
Gabriel completi davvero la validazione**: dalla pagina "Domains and senders" di Mailjet, cliccare
l'icona a ingranaggio sulla riga del mittente -> "Validate" -> "Send the confirmation email again",
poi controllare la casella (anche spam) e cliccare sul link ricevuto. Una volta che lo Status passa
da "Pending" a validato, rifare un ultimo test dal vivo dal flusso pubblico per la conferma finale.
Nota per il futuro: il nostro `inviaEmail()` tratta `Status: "success"` come "ok, consegnato", ma
evidentemente l'API di Mailjet può rispondere "success" anche per un invio poi bloccato a valle per
mittente non validato -- il fail-open, corretto come principio (non deve mai far fallire una
prenotazione), qui ha reso più lento diagnosticare il problema reale, perché sembrava tutto a posto
lato nostro codice quando non lo era lato Mailjet.

Aggiornamento precedente, 13/09/2026, undicesimo giro -- verificato via log Vercel che il fix del giro
precedente (enum Mailjet rotto dal bundling Turbopack) è davvero in produzione e ha funzionato.
Dopo il deploy del fix, Gabriel ha rifatto un test dal vivo sul **flusso pubblico** (non dashboard:
il tenant di prova "Salone Test Claude" ha come titolare un indirizzo finto
`claude.test.lista.attesa@example.com`, quindi un test solo-dashboard non può mai arrivare in una
casella reale -- vedi nota sotto), prenotazione "Test Fix Definitivo" il 19/09/2026 09:00 con email
cliente `gabrielmazzucchelli3@gmail.com`. Letti i log runtime Vercel (stesso percorso via browser
già autenticato, il tool MCP resta rotto):
- Un primo tentativo (15:06:01) è fallito con un errore innocuo e transitorio, non legato al fix:
  `Errore risolvendo il tenant dallo slug: salone-3ad8c9ad { message: 'Gateway Timeout' }` --
  timeout della REST API di Supabase, non del nostro codice (corrisponde al messaggio "Attività non
  trovata" visto e poi risolto con un secondo tentativo).
- Il secondo tentativo (15:06:39, 200, 2.59s) è quello andato a buon fine ("Prenotazione
  confermata!" a schermo). Nel dettaglio "Function Invocation" di quella richiesta compaiono, dopo
  le chiamate a Supabase, **due `POST api.mailjet.com/v3.1/send`** -- una per la notifica al
  titolare e una per la conferma al cliente, come atteso quando il cliente lascia un'email.
  Filtrando i log per `level:error` nella stessa finestra temporale, l'unico altro errore trovato è
  quello vecchio delle 14:43:25 (il bug dell'enum, **precedente** al fix/deploy -- è proprio il log
  che aveva permesso di diagnosticarlo nel giro precedente). **Nessun errore associato alla
  richiesta delle 15:06:39**: `inviaEmail()` logga sempre un `console.error` sia per eccezioni sia
  per `Status !== "success"` dalla risposta Mailjet, quindi la sua assenza qui è un forte indizio
  (non una controprova assoluta, i log Vercel non mostrano il body della risposta Mailjet
  chiamata per chiamata) che entrambi gli invii sono stati accettati.
**Serve la conferma finale di Gabriel**: controllare `gabrielmazzucchelli3@gmail.com` (posta in
arrivo e spam) per due email relative alla prenotazione "Test Fix Definitivo" del 19/09 09:00 sul
tenant "Salone Test Claude" -- una di notifica titolare, una di conferma cliente. Se sono arrivate,
il fix del giro precedente è chiuso e verificato end-to-end. Nota per i test futuri: qualunque test
fatto **solo da dashboard** su questo tenant di prova notifica un indirizzo finto e inesistente
(`claude.test.lista.attesa@example.com`, verificato via query diretta su `auth.users`) -- per
verificare la consegna reale serve sempre passare dal flusso pubblico (o dalla caparra) con
l'email di Gabriel come contatto cliente.

Aggiornamento precedente, 13/09/2026, decimo giro -- **trovata e corretta la vera causa per cui
nessuna email di notifica è mai partita**, dopo diversi cicli di troubleshooting sul mittente
Mailjet (tutti indizi reali ma non la causa di fondo: prima `MAILJET_FROM_EMAIL` mancante su
Vercel, poi il mittente Gmail non validato -- entrambi corretti da Gabriel, ma le email
continuavano a non arrivare e su Mailjet Statistics non compariva nulla). Il pannello Vercel
del progetto è risultato già autenticato nel browser di Gabriel (stessa sessione usata per i test
sul sito) -- da lì, lettura diretta dei **log runtime** (Settings non serviva, bastava
"Logs" nel progetto): ogni invio falliva con `TypeError: Cannot read properties of undefined
(reading 'ResponseStatus')`. Causa reale: `src/lib/email/mailjet.server.ts` confrontava l'esito
di Mailjet con l'enum `SendEmailV3_1.ResponseStatus.Success` importato da `node-mailjet` -- quel
namespace esiste regolarmente sotto `vitest` (risoluzione moduli standard di Node), ma **risulta
`undefined` nel bundle di produzione Next.js/Turbopack usato da Vercel**, quindi ogni invio andava
in eccezione prima di completarsi. Bug invisibile a tutti gli 11 test dedicati (che mockano
`node-mailjet` fornendo loro stessi un `SendEmailV3_1.ResponseStatus` funzionante) e a
`tsc`/`eslint`/`build` (tutti puliti, è un problema di risoluzione moduli a runtime, non di tipi).
**Corretto** confrontando con la stringa letterale `"success"` (il valore JSON reale che l'API di
Mailjet restituisce) invece dell'enum -- `SendEmailV3_1` resta importato solo per i tipi
(`.Response`, `.Body`), che si cancellano a compile-time e non soffrono di questo problema.
`tsc`/`eslint`/`vitest` (149/149)/`build` puliti dopo la correzione. **Non ancora verificato con
un nuovo invio reale** -- serve il deploy di questa correzione, poi un altro test dal vivo.
Lezione per il futuro: quando un modulo di terze parti espone sia tipi che valori runtime tramite
un unico namespace TypeScript, verificare il comportamento del valore anche nel bundle di
produzione reale (non solo sotto `vitest`), specialmente con Turbopack.

Aggiornamento precedente, 13/09/2026, nono giro -- Gabriel ha completato la sua parte (validato
l'indirizzo Gmail su Mailjet, impostato `MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE`/`MAILJET_FROM_EMAIL`
su Vercel) e ha chiesto di fare un test dal vivo dell'invio email. Eseguiti due test reali sul
tenant di prova "Salone Test Claude" (produzione, `salone-3ad8c9ad`):
1. **Dashboard** (`/dashboard/calendario`, 13/09 09:00, cliente "Test Email Claude" senza email) --
   verifica del canale che copre sempre la notifica al titolare (quel form non raccoglie l'email
   del cliente, solo nome/telefono).
2. **Flusso pubblico diretto** (`/s/salone-3ad8c9ad`, 14/09 09:00, cliente "Gabriel Test Pubblico",
   email `gabrielmazzucchelli3@gmail.com`) -- verifica di entrambe le email, titolare + conferma
   cliente, sullo stesso indirizzo Gmail usato come mittente.
Entrambe le prenotazioni sono state accettate correttamente dall'interfaccia ("Prenotazione
confermata!"). **Non posso verificare da qui se le email sono arrivate davvero in una casella di
posta** (nessun accesso alla webmail di Gabriel) né leggere i log runtime di Vercel per controllare
eventuali errori Mailjet lato server: il tool MCP di Vercel risulta ancora non collegato
correttamente all'account di Gabriel (`list_teams` torna vuoto, come nel giro precedente) --
**serve conferma manuale di Gabriel**: controllare la casella `gabrielmazzucchelli3@gmail.com`
(anche nello spam, dato il rischio SPF/DKIM già segnalato per un mittente Gmail via server terzi).
I due appuntamenti di test restano nel tenant di prova, cancellabili da Gabriel dalla dashboard se
non servono più.

Aggiornamento precedente, 13/09/2026, ottavo giro -- delega ampia di Gabriel ("dobbiamo implementare
tutte le funzioni, leggi gli md e fai tu quello che ritieni necessario ora") dopo la chiusura del
settimo giro sotto. Rileggendo `PIANO.md`, la priorità più alta rimasta era Gruppo B-bis #1: zero
notifica email quando arriva una prenotazione, né per il titolare né per il cliente. Costruito da
zero (inizialmente su Resend, cambiato lo stesso giorno a Mailjet -- Gabriel aveva già un account
con una key dedicata al progetto, e a piano gratis Mailjet è più generoso: 6.000 email/mese contro
3.000, vedi DECISIONS.md): `src/lib/email/mailjet.server.ts` (wrapper Mailjet fail-open -- senza
le chiavi `MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE` o con qualunque errore/eccezione non lancia mai,
ritorna `false` e logga) + `notifiche.server.ts` (email al titolare SEMPRE, indirizzo risolto via
`profiles.ruolo='owner'` + `auth.admin.getUserById()` perché `tenants.email` non è mai popolata;
email di conferma al cliente solo se ha lasciato un indirizzo). Agganciato dentro
`creaAppuntamentoTenant`, l'unica funzione di scrittura degli appuntamenti (punto 9 di CLAUDE.md)
-- copre automaticamente tutti e quattro i canali (dashboard, AI, pubblico diretto, caparra/Stripe)
senza duplicare la chiamata. Raccolta dell'email aggiunta come campo facoltativo nel flusso
pubblico (`FlussoPrenotazione.tsx`); per il flusso con caparra serve la nuova colonna
`richieste_caparra.cliente_email` (migrazione `0015_email_cliente_caparra.sql`, **applicata da
Claude al database reale su ok esplicito di Gabriel**, verificata in
`supabase_migrations.schema_migrations`). Dettaglio completo, alternative scartate e limitazioni
oneste (email raccolta solo dal flusso pubblico, nessun retry sugli invii falliti, nome mittente
fisso "Salone AI" per ogni tenant) in DECISIONS.md. Gabriel userà per ora la propria Gmail come
mittente di test, sapendo che rischia lo spam per mancato allineamento SPF/DKIM (Google stesso lo
sconsiglia per invii tramite server terzi) -- scelta consapevole, rimandato un dominio vero a
quando servirà mandare email affidabili a clienti reali. **Resta da fare, tocca a Gabriel**:
validare quell'indirizzo sul pannello Mailjet (un click via email) e impostare
`MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE`/`MAILJET_FROM_EMAIL` su Vercel (senza, il modulo resta
silenziosamente disattivato, nessuna prenotazione si rompe). 11 test dedicati (rifatti per
Mailjet), `tsc`/`eslint`/`vitest` (149/149, da 138)/`build` tutti puliti -- non ancora verificato
con un invio email reale.

Aggiornamento precedente, 13/09/2026, settimo giro -- Gabriel ha detto "d'ora in poi i test li fai tu
su google" e poi "crea tu un nuovo account di test e fai tutto tu": creato un tenant di prova
dedicato ("Salone Test Claude", slug `salone-3ad8c9ad`, via `/registrati` -- nessuna conferma
email richiesta in questo progetto Supabase, sessione autenticata subito) per testare dal vivo
senza toccare i dati reali di Gabriel né dover usare le sue credenziali (che comunque non
inserirei mai al posto suo). Configurato orari/operatore/servizio di test, poi provata una vera
prenotazione dal flusso pubblico diretto (`/s/[slug]`, senza AI) per arrivare a testare il ciclo
completo della lista d'attesa (prenota -> qualcun altro si iscrive in coda -> cancella -> verifica
il match).

**Trovato un bug critico, non della lista d'attesa ma della prenotazione pubblica stessa**: ogni
tentativo di completare una prenotazione diretta falliva con "Orario non valido, riprova la
ricerca.", sempre, per qualunque slot. Causa: `cercaSlotPubblici` genera gli orari con
`Date.toISOString()` (che include sempre i millisecondi, es. "2026-09-14T09:00:00.000Z"), ma la
validazione rigida di `parsaOrarioLocale` non li ammetteva -- quindi la prenotazione falliva
SEMPRE, per QUALUNQUE tenant, non solo quello di prova. Il flusso via chat AI e la dashboard non
sono toccati (usano formati diversi, senza millisecondi). Non è possibile sapere da quando questo
bug fosse live in produzione né quante prenotazioni reali dirette siano fallite nel frattempo --
nessun dato perso (l'appuntamento semplicemente non si creava, il cliente vedeva solo l'errore),
ma un intero canale di prenotazione self-service era inutilizzabile senza che nessun log lo
segnalasse come anomalia (sembra un errore di validazione, non un bug). **Corretto** allargando
la regex condivisa di `parsaOrarioLocale` per ammettere i millisecondi opzionali (dettaglio in
DECISIONS.md) + 2 test di regressione aggiunti. `tsc`/`eslint`/`vitest` (138/138)/`build` puliti.
**Non ancora deployato/verificato dal vivo sul sito reale** -- serve il push di Gabriel per
verificare anche questo fix con una vera prenotazione diretta (finora verificato solo con
`vitest`/`build`, non con un click reale sul sito, perché il fix non è ancora online).

**Nel frattempo, completato comunque il test end-to-end della lista d'attesa che aveva motivato
questo giro**, aggirando il bug (non ancora deployato) con l'unica altra strada che non lo
attraversa -- creazione dell'appuntamento da testare da `/dashboard/calendario` (che usa un
parsing diverso, non toccato dal bug) invece che dal flusso pubblico:
1. "Cliente B Test" si iscrive alla lista d'attesa per "Taglio Test" oggi (13/09) **dal flusso di
   prenotazione pubblico diretto** (`iscrivitiListaAttesaPubblico`, il canale aggiunto ieri) --
   confermato "Fatto -- se si libera un posto... ti contattiamo noi.".
2. "Cliente A Test" prenotato lo stesso slot (09:00, stesso servizio/operatore) da
   `/dashboard/calendario`.
3. Appuntamento di Cliente A cancellato dalla dashboard.
4. **Match automatico scattato correttamente**: banner immediato "🔔 Lo slot appena liberato era
   atteso da Cliente B Test · 3339998888 (Taglio Test) -- contattalo per riproporglielo.".
5. `/dashboard/lista-attesa` mostrava la riga con lo stato giusto ("in coda (1 da contattare)",
   nota "Si è liberato un posto compatibile il 2026-09-13 alle 09:00").
6. Testato anche "Segna risolto": la riga sparisce correttamente dalla lista attivi.

**Prima verifica dal vivo completa e positiva di tutta la catena della lista d'attesa** (fino ad
oggi solo scritta/testata con vitest, mai vista funzionare in un browser reale). Non ancora
testata l'iscrizione dalla chat AI in questa sessione (già verificata in una sessione precedente,
non riverificata qui per limiti di tempo). Tenant di prova ("Salone Test Claude") ancora vivo sul
database reale -- da valutare con Gabriel se ripulirlo o tenerlo per test futuri.

Aggiornamento precedente, 13/09/2026, sesto giro -- Gabriel ha chiesto se il cliente può iscriversi
alla lista d'attesa da solo con l'AI o con la prenotazione online, senza lo staff. Risposta
onesta: con l'AI sì (già costruito), dal flusso di prenotazione passo-passo no -- chi non usava
la chat vedeva solo "nessuna disponibilità, prova un altro giorno" e uscivo dal sito senza
lasciare traccia. Gap vero, chiuso lo stesso giorno: nuova server action pubblica
`iscrivitiListaAttesaPubblico` (`src/app/s/[slug]/azioni.ts`) + un piccolo form inline (nome,
telefono) mostrato in `FlussoPrenotazione.tsx` quando `cercaSlotPubblici` non trova slot --
stessa unica funzione di scrittura di sempre (`aggiungiListaAttesaTenant`). `lista_attesa.creato_da`
allargato da `'manuale'|'ai'` a `'manuale'|'ai'|'pubblico'` (migrazione
`0014_lista_attesa_pubblico.sql`, stessa terna già usata da `appuntamenti.creato_da`).
`tsc`/`eslint`/`vitest` (136/136)/`build` puliti. Migrazione `0014_lista_attesa_pubblico.sql`
**applicata al database reale il 13/09/2026** (constraint verificato via query diretta).

Aggiornamento precedente, 13/09/2026, quinto giro -- Gabriel ha provato la lista d'attesa dal vivo
(aggiunti due clienti veri, Federico e Daniele) e non vedeva niente né in
`/dashboard/lista-attesa` né sul calendario. Verificato subito via query diretta: le righe
c'erano davvero nel database, tenant e servizio corretti -- quindi non un problema di
inserimento ma di lettura. **Trovata la causa reale**: `lista_attesa` ha due foreign key verso
`operatori` (`operatore_id` e `slot_liberato_operatore_id`), e la query della pagina faceva
`operatori(nome)` senza specificare quale delle due -- PostgREST rifiuta l'embed come ambiguo,
la select falliva, e il codice ignorava l'errore in silenzio mostrando "nessuno in lista"
invece di un messaggio d'errore. **Corretto**: hint esplicito sulla colonna
(`operatori!operatore_id(nome)`) + un `console.error` se la query fallisce comunque, così un
errore simile non sparisce più senza lasciare traccia. Confermate le due foreign key via
`pg_constraint` sul database reale (non un'ipotesi). `tsc`/`eslint`/`vitest`
(136/136)/`build` puliti dopo il fix. Chiarito anche a Gabriel che aggiungere qualcuno alla
lista d'attesa non fa succedere nulla di per sé (e giustamente NON appare sul calendario, non è
un appuntamento): il trigger vero è cancellare un appuntamento del suo stesso servizio.

Aggiornamento precedente, 13/09/2026, quarto giro -- Gabriel ha chiesto di verificare dal vivo il
Tono AI ("puoi provare tu a vedere se funziona usando il sito?"). Prima difficoltà onestamente
segnalata: l'estensione Chrome non risultava collegata in sessione, i tentativi di rete diretta
dal sandbox verso il dominio Vercel erano bloccati da una policy dell'organizzazione, e
`WebFetch` può solo leggere pagine (GET), non inviare messaggi in chat (serve una POST) --
risolto facendo riavviare a Gabriel l'estensione Chrome sul suo Mac, dopo di che il collegamento
ha funzionato. Test dal vivo riuscito (dettaglio sopra, sezione "Tono dell'AI personalizzabile")
e confermato via `git ls-remote` che il push di Gabriel era già arrivato su `origin/main`. Poi
costruito il terzo task ad alta priorità di `PIANO.md` (Gruppo B): **Lista d'attesa automatica
alla cancellazione** (Fase 6) -- tabella `lista_attesa`, match automatico dentro
`cancellaAppuntamentoTenant`, nuovo strumento AI `aggiungi_lista_attesa`, dashboard
`/dashboard/lista-attesa` + banner in `/dashboard/calendario` (dettaglio sotto, sezione "Cosa è
mock"). Notifica al cliente resta manuale (nessun provider email/SMS ancora, gap già tracciato).
Verificato: `tsc --noEmit`, `eslint`, `npx vitest run` (136/136, +11 test nuovi), `next build`
tutti puliti. Migrazione `0013_lista_attesa.sql` scritta ma non ancora applicata al database
reale, in attesa dell'ok di Gabriel.

Aggiornamento precedente, 13/09/2026, terzo giro -- "applicala e continua a lavorare": applicata al
database reale la migrazione del deposito/caparra (`0011`, `weeaggiqovnmtovdjzxy`, nessun
problema dai controlli di sicurezza Supabase), poi costruito il secondo task ad alta priorità
di `PIANO.md`: **Tono dell'AI personalizzabile** (Fase 5, bloccante prima di vendere Pro).
Guidato a 3 opzioni fisse (professionale/amichevole/informale con emoji) + una nota libera
opzionale (max 300 caratteri, sanitizzata -- niente a capo/tab, incorniciata nel system prompt
come indicazione supplementare che non può mai sovrascrivere le regole assolute). UI in
`/dashboard/impostazioni/tono-ai`, gate di piano Pro/Enterprise applicato in tre punti (UI,
server action, endpoint chat) -- mai fidarsi solo del valore salvato sul tenant. Migrazione
`0012_tono_ai.sql` **applicata anche questa al database reale** (stesso via libera di
Gabriel). Verificato: `tsc --noEmit`, `eslint`, `npx vitest run` (125/125, +7 test nuovi),
`next build` -- tutti puliti. Non ancora verificato dal vivo con un salone di test reale
(nessun cliente Pro reale ancora). Consegnato anche il bundle con tutto il lavoro fermo da
prima (Hero, Vetrina, tilt, CompareSlider, deposito/caparra, audit promesse) direttamente nella
cartella `~/dev/salone-ai-saas` di Gabriel via il collegamento al suo Mac, in attesa che lui
lanci `git pull`+`git push` dal proprio Terminal (il push diretto da questa sessione resta
bloccato, nessuna credenziale per il repo in questa sandbox).

Aggiornamento precedente, 13/09/2026, secondo giro -- Gabriel ha chiesto di controllare che ogni
promessa fatta sul sito ("aggiungi negli obiettivi tutte le promesse che ci sono nel sito se non
le hai messe") sia davvero tracciata come obiettivo. Letto riga per riga tutto il copy della
landing (Nav, Hero, ProdottoScroll, ComeFunziona, PrimaDopo, ImpattoEconomico, Vetrina,
PercheNoi, Funzionalita, PerChi, Prezzi, Faq, CTAFinale, Footer) ed estratta ogni promessa
concreta, verificata una per una contro il codice reale. Oltre alle due già note (Tono AI su
Pro, Multi-sede su Enterprise), **trovate 4 promesse non ancora tracciate come task esplicito**:
SMS (Pro, zero codice/provider, mai menzionato prima in nessun documento), Analytics/"andamento
nel tempo" (Growth, task Analytics esisteva già ma non collegato a questa promessa specifica),
Promemoria automatici (Growth, usati anche nel calcolo ROI di `ImpattoEconomico.tsx` come
argomento di vendita diretto -- zero codice, nessun provider email/SMS/WhatsApp per invii
automatici), PWA/app installabile (task già esisteva ma non collegato al fatto che è anche voce
di prezzo Enterprise). Trovato anche un piccolo caso opposto: il piano Free pubblicizza "1
operatore" ma nessun controllo tecnico lo applica (il prodotto fa più di quanto promesso, non
meno -- rischio di revenue, non di reputazione). Tutto aggiunto in `PIANO.md`, nuova sezione
"Gruppo E" con l'elenco completo verifica-per-verifica. Nessuna modifica di codice in questo
giro, solo ricerca e documentazione. Nessuna di queste è urgente per il codice: sono tutte
coperte dalla decisione già presa con Gabriel il 12/09/2026 ("il sito descrive il prodotto al
lancio, non lo stato di oggi" -- vedi DECISIONS.md), cioè vanno costruite prima di aprire i
pagamenti veri su quel piano, non prima di oggi.

Aggiornamento precedente, 13/09/2026 -- Gabriel ha detto "quando hai finito di controllare inizia
il lavoro seguendo gli md": fine della fase di sola documentazione, iniziata l'implementazione
vera seguendo l'ordine di priorità di `PIANO.md` (Gruppo B, punto 1). **Costruito il Deposito/
caparra anti-no-show** (Fase 6): configurabile per tenant (`/dashboard/impostazioni/caparra`,
attiva/disattiva, percentuale o importo fisso), integrato nella pagina pubblica di prenotazione
(`/s/[slug]`, `FlussoPrenotazione.tsx` mostra l'importo prima di far scegliere al cliente se
procedere) tramite una nuova Stripe Checkout Session in modalità "payment" (diversa da quella
già esistente per gli abbonamenti, che resta "subscription") -- stesso webhook Stripe di sempre,
un ramo nuovo riconosciuto da `session.metadata.tipo === "caparra"`. Scelta di design importante:
l'appuntamento vero e proprio NON viene creato finché il pagamento non è confermato dal webhook
(mai un appuntamento "fantasma" non pagato in calendario) -- dettaglio e limite onestamente
segnalato (lo slot non è bloccato durante il pagamento, mitigato con un rimborso automatico in
caso di conflitto) in "Problemi noti aperti" qui sotto e nel commento della migrazione
`0011_deposito_caparra.sql`. Verificato: 6 nuovi test per il calcolo dell'importo
(`stripe/caparra.test.ts`) + 2 nuovi test per il profilo pubblico aggiornato
(`pagina-pubblica.server.test.ts`), suite intera **119/119 verdi**, `tsc --noEmit` pulito,
`eslint` pulito, `next build` pulito (nuova rotta `/dashboard/impostazioni/caparra` compilata
correttamente). **NON ancora verificato dal vivo**: la migrazione non è stata applicata al
database reale (il classificatore di sicurezza della sandbox ha bloccato l'applicazione
automatica come "modifica di una risorsa condivisa" -- corretto non farlo senza il tuo ok
esplicito, è la stessa cautela di sempre su push/deploy) e servirebbe comunque un pagamento di
test reale nel browser per la verifica end-to-end, che solo tu puoi fare. Vedi "Cosa è mock,
incompleto o non ancora iniziato" per il dettaglio completo e i prossimi passi.

Aggiornamento precedente, 12/09/2026 notte, secondo giro -- Gabriel ha chiesto di continuare a
controllare che tutti gli .md siano giusti e di aggiungere agli obiettivi altre funzioni
mancanti. Due cose fatte: (1) **corretti altri due file rimasti indietro**, oltre ai due già
sistemati nel giro precedente -- `docs/embedded-signup-whatsapp.md` dava la colpa a "il
progetto Supabase non è ancora collegato (in corso)" per un TODO nel codice, quando Supabase è
collegato e in uso da settimane (il vero motivo è il blocco Meta, non Supabase); e
`docs/verifica-stack-automazione.md` mostrava foto/PWA come "Sì, automatico" in una tabella di
fattibilità architetturale senza chiarire che non sono ancora costruite, annotato con una nota
esplicita. (2) **Trovate altre funzioni mancanti**, questa volta non dal confronto competitor ma
da un confronto diretto codice-vs-aspettativa di prodotto: zero notifiche email (né conferma al
cliente né avviso al titolare -- verificato, nessun provider email nel progetto), il cliente non
può gestire da solo la propria prenotazione dopo averla fatta, e un secondo caso del problema già
trovato con "Tono AI" -- il piano Enterprise pubblicizza "Multi-sede e ruoli avanzati" ma non
esiste NESSUN concetto di sede nello schema né un controllo reale sul ruolo owner/staff (la
colonna esiste, non è mai controllata da nessuna parte del codice). Aggiunte anche idee a
priorità più bassa (recensioni post-appuntamento, export CSV clienti, pacchetti prepagati/
tessera fedeltà) e una NON aggiunta deliberatamente (registro cassa/fatturazione -- rischio di
scope creep verso un gestionale contabile, vedi DECISIONS.md). Tutto il dettaglio in `PIANO.md`,
sezione "Gruppo B-bis" (nuova). Nessuna modifica di codice in questo giro. Aggiornamento
precedente, 12/09/2026 notte -- "mega controllo" competitor richiesto da Gabriel
("cosa dobbiamo fare per superare i competitor"). Risultato più importante, e più urgente di
tutto il resto scritto in questo file: **Treatwell ha lanciato un'AI receptionist il 9/09/2026
(3 giorni prima di questo controllo) e Fresha ha "AI Concierge" da maggio 2026** -- il nostro
argomento di vendita principale ("un'AI che risponde da sola ai clienti") sta diventando
standard tra i grandi marketplace, non è più raro sul mercato generale (resta vero solo contro i
gestionali italiani senza AI -- Estetia, WeGest -- ed è già falso contro CutApp, concorrente
italiano diretto verificato in questo giro con un'AI booking reale su WhatsApp, seppur a
pagamento a consumo). Non cambia SE il progetto ha senso, cambia SU COSA vincere: dettaglio
completo e sintesi strategica aggiornata in `docs/analisi-concorrenti-mercato.md` (sezione
"AGGIORNAMENTO CRITICO") e `PIANO.md` (sezione "Sintesi strategica", in cima al file). In breve,
la combinazione difendibile ora è zero commissione/zero app obbligatoria per il cliente finale
(strutturale, i marketplace non possono replicarla), deposito/caparra anti-no-show (gap reale
verificato in TUTTO il software italiano di categoria, non ancora costruito -- nuovo task Fase
6 di `PIANO.md`, priorità alta), prezzo tutto incluso mai a consumo (vero contro CutApp), target
volutamente più ampio del solo settore beauty. **Trovato anche un problema nostro**: il piano
Pro pubblicizza "Tono dell'AI personalizzabile" che non esiste nel codice (nessuna colonna/UI/
collegamento al prompt) -- non urgente oggi (nessun cliente Pro reale ancora) ma bloccante prima
di aprire i pagamenti veri su quel piano, nuovo task esplicito in Fase 5 di `PIANO.md`. Nessuna
modifica di codice in questo giro: solo ricerca e aggiornamento dei piano/documenti, come
richiesto. Aggiornamento precedente, 12/09/2026 notte -- controlli generali dell'interfaccia richiesti da
Gabriel ("continua a fare controlli generali dell'ui"), non un giro su un punto specifico.
Metodo: screenshot con SCROLL VERO (non un `fullPage` istantaneo, che non fa scattare le reveal
`whileInView` e produce falsi "buchi neri" -- capitato e verificato come falso positivo in questo
stesso giro) sui 3 breakpoint (mobile 390px, tablet 768px, desktop 1440px), poi test funzionali
delle interazioni chiave. **Un bug reale trovato**: nel confronto trascinabile "prima/dopo"
(`CompareSlider.tsx`), alla posizione di riposo le due frasi ai lati del taglio si leggevano come
una frase sola (es. "Cliente in attesa da 40 minut[i]" + "[2]4 ore su 24") perché il taglio netto
cade in mezzo a due liste che raccontano cose diverse riga per riga, non la stessa foto ritoccata
ai due lati. Un primo tentativo di fix (dissolvenza `mask-image`) è stato provato e SCARTATO dopo
verifica dal vivo -- sfuma l'opacità, non la leggibilità, quindi il problema restava solo più
graduale. Fix vero: separare fisicamente le due frasi con una fessura opaca/sfocata larga 64px
fissi (non percento) invece di provare a fonderle (dettaglio completo, incluso perché 22px non
bastava, in DECISIONS.md). Verificato su desktop (30/50/70%), tablet e mobile. **Il resto del
controllo non ha trovato altri bug**: tutti i 38 screenshot a scroll vero (17 desktop, 15 tablet,
21 mobile) puliti, zero errori console/pageerror su tutti e 3 i breakpoint; smooth-scroll dei link
di navbar verificato numericamente (atterra sotto l'header fisso su tutte e 3 le sezioni); FAQ
accordion verificato in apertura/chiusura multipla (è "a fisarmonica singola" -- ne apri una,
le altre si chiudono -- comportamento corretto, non un bug); hover dei bottoni CTA verificato
numericamente (il `hover:scale-[1.03]` di Tailwind applica davvero, solo troppo sottile per
vedersi a occhio in uno screenshot statico); `/registrati` e `/accedi` controllati su desktop e
mobile, zero errori, nessuna regressione. tsc/eslint/vitest(112/112)/build puliti. Fix committato
(`4454b72`), in attesa di ok di Gabriel prima del push insieme al resto già pronto di questo
batch di sessioni (titolo interattivo, colori Growth, fix clipping Vetrina). Aggiornamento
precedente, 12/09/2026 sera, quinto giro SETTIMA PARTE -- Gabriel: "prenditi tutto il
tuo tempo per migliorarlo". Approfondito l'effetto interattivo della sesta parte: ora anche le
BANDE del metallo (non solo il riflesso puntuale) seguono il tilt, spostandosi verticalmente
come farebbe una vera superficie di metallo spazzolato inclinata (riflette punti diversi
dell'ambiente a seconda dell'angolo). Fatta anche una verifica più a fondo del solito prima di
rimandare a Gabriel: prefers-reduced-motion confermato senza listener/transform/errori,
spostamento delle bande confermato numericamente sopra/sotto il punto di attivazione, tablet
(768px) e mobile (390px) controllati per escludere clipping o rotture di layout (l'effetto
resta correttamente inerte senza mouse). tsc/eslint/vitest(112/112)/build puliti. GIF aggiornata
mandata a Gabriel, in attesa di ok prima del push. Aggiornamento precedente, 12/09/2026 sera,
quinto giro SESTA PARTE -- Gabriel, richiesta aperta dopo
i colori Growth: "vedi se il titolo può diventare più bello". Aggiunta una reazione vera al
mouse (non solo il loop automatico già tarato): lieve tilt 3D dell'intero titolo + un secondo
riflesso puntuale che segue il cursore, sulla falsariga di come LiquidMetal reagisce già allo
sfondo. Un solo listener su `window` (il contenitore è `pointer-events-none` apposta, un
listener sull'h1 stesso non riceverebbe mai l'evento). tsc/eslint/vitest(112/112)/build puliti,
verificato anche il transform CSS calcolato in posizioni opposte del mouse (segni di rotazione
invertiti correttamente) e il bagliore puntuale in 4 posizioni via Playwright. Screenshot/GIF
mandati a Gabriel, in attesa di ok prima del push. Aggiornamento precedente, 12/09/2026 sera -- ricerca di mercato richiesta da Gabriel (Fresha/
Treatwell/Booksy: prezzi, commissioni, design, e verifica dal vivo di quanti saloni a Grumello
del Monte e dintorni li usano già). Aggiunto tutto a `docs/analisi-concorrenti-mercato.md`
(sezioni "Marketplace generalisti" e "Mercato locale"), sintesi consegnata a Gabriel come
report a parte. Nessuna modifica di prodotto in questo giro, solo ricerca/documentazione --
lavoro svolto in autonomia mentre Gabriel non poteva seguire in diretta. Aggiornamento
precedente, 12/09/2026, quinto giro QUINTA PARTE (due segnalazioni indipendenti di
Gabriel, entrambe con bug reali dietro). Prima: il titolo Hero era "carino ma poco premium... poco
lucido e troppo opaco", con una richiesta specifica -- "prendi spunto dal colore dei pulsanti,
tipo il pulsante di growth, non riesci a dare il bordo ad ogni lettera come il bordo viola
metallico del pulsante growth?". Le bande di metallo e il contorno del titolo usavano una tinta
viola VOLUTAMENTE desaturata (scelta della terza parte: "i metalli sono desaturati anche con una
tinta"), ma Gabriel voleva letteralmente i colori SATURI del pulsante Growth, non un'interpretazione
attenuata -- ricalcolato tutto (contorno chiaro/scuro, bande, riflesso) con `colorsys` sulle 4
tinte esatte di `METAL_PIANI.Growth.colors`, ripetute a bande chiaro-scuro (tecnica del "testo
cromato") invece di un gradiente morbido, e il riflesso animato schiarito con `mixBlendMode:
"screen"` (schiarisce sempre) al posto di `"overlay"` (che poteva scurire, contro-intuitivo per
un riflesso). Seconda segnalazione, uno screenshot separato durante lo stesso giro ("anche questo
viene tagliato"): la sezione "Vetrina" (scrollytelling con pin GSAP) aveva lo STESSO identico bug
già risolto su mobile nel primo giro di questo batch, ma su DESKTOP -- la lista di 6 voci veniva
pinnata insieme al palco di destra dentro un unico blocco `position: fixed`, e su una finestra non
altissima l'ultima voce ("Il tuo calendario personale...") restava sempre oltre il bordo inferiore,
mai raggiungibile. Fix strutturale (non un ritocco di stile): pinnare SOLO il palco (piccolo,
entra ovunque), rendere la lista `position: sticky` con scroll interno di sicurezza -- ma la sticky
positioning ha richiesto due correzioni non ovvie trovate solo scrollando DAVVERO con Playwright
(non leggendo il CSS): un `overflow-hidden` su un antenato (per la texture di sfondo) disattivava
sticky su TUTTI i discendenti; e `items-center` su una riga di griglia alta 5400px centrava il
palco di destra a metà di quell'altezza (fuori schermo) proprio nel momento in cui GSAP calcolava
dove pinnarlo. Vedi le due sezioni dedicate più sotto per il dettaglio completo. Aggiornamento
precedente, 12/09/2026 quinto giro QUARTA PARTE (Gabriel ha guardato ancora il titolo
Hero e il pulsante Pro sul sito vero: "carino ma... troppo spento", "ce ancora lo sfondo sfumato
scuro dietro la frase", "le p sono tagliate sotto", "rallenta l'animazione e migliorala", e "il
pulsante di pro tende ancora al verde... fai solo oro"). Cinque correzioni, tre delle quali bug
di layout/rendering reali e non solo gusto estetico -- vedi la sezione dedicata più sotto per il
dettaglio completo:
1. **Bug reale -- lettere "p" tagliate**: il contenitore `overflow-hidden` usato per l'animazione
   di entrata (la riga scorre su dall'alto) si dimensionava esattamente sull'altezza della riga di
   testo, calcolata dai metrics del font senza considerare che un `-webkit-text-stroke` da 4px
   sporge ~2px oltre il bordo di ogni lettera, discendenti comprese -- su un `line-height` già
   stretto (1.08, per un titolo compatto) quei 2px in più finivano tagliati dal contenitore.
   Aggiunto padding in basso al contenitore (non toccato il line-height condiviso con la prima
   riga del titolo, per non spostare nulla lì).
2. **Bug reale -- alone scuro ancora visibile dietro la frase**: un secondo effetto, distinto dal
   `text-shadow` già corretto nella terza parte, restava attivo -- `filter: drop-shadow(...)`,
   aggiunto per dare profondità senza triplicarsi sulle quattro copie di testo impilate. Anche
   modesto (5px di sfocatura), un'ombra scura sopra uno sfondo chiaro/saturo si legge comunque come
   un alone. Tolto del tutto: il contorno a due toni basta da solo per leggibilità e profondità.
3. Colori delle bande metalliche ricalcolati una quarta volta con `colorsys` (stessa progressione
   di tonalità freddo->caldo di prima, MAI a occhio) ma con un range di luminosità/saturazione più
   ampio -- il giro precedente aveva la tonalità giusta ma restava "spento", troppo compresso al
   centro.
4. Riflesso animato: rallentato ulteriormente (già chiesto e fatto una volta) e la FORMA della
   fascia di luce cambiata da bordi netti a una curva morbida più larga, per un accendersi/spegnersi
   graduale invece di un lampo.
5. **Bug reale -- causa del pulsante Pro percepito ora oro ora verde**: diagnosticato leggendo lo
   shader (`LiquidMetal.tsx`), non a occhio -- la tonalità dell'intera palette ruota nel tempo di
   un'ampiezza proporzionale a `shimmer` (±20° con `shimmer: 7`), e la tonalità oro precedente
   (~31-42°) con quella rotazione finiva a tratti nella zona giallo-verde. Ricalcolata la palette
   con `colorsys` su tonalità molto più basse (~22-34°, più arancio-ruggine) perché anche il picco
   della rotazione resti saldamente nell'oro, e ridotto leggermente `shimmer` (7 -> 6) per
   restringere l'ampiezza stessa. Non verificabile in questa sandbox (il contesto WebGL non
   rende mai in modo affidabile qui) -- da confermare sul sito vero.

Aggiornamento precedente, 12/09/2026 quinto giro TERZA PARTE (Gabriel ha guardato il sito vero via
screenshot e chiesto di verificare ogni fix con uno screenshot PRIMA del prossimo push, non solo
alla fine -- workflow seguito per tutto questo giro). Titolo Hero rifatto tre volte in un solo
giro, con due bug reali trovati lungo il percorso (non solo gusto estetico): il colore era stato
verificato contro uno sfondo scuro finto invece che contro quello vero, chiaro/saturo, della Hero
(corretto usando lo screenshot REALE di Gabriel come sfondo di prova in Playwright); e
`text-shadow`, proprietà EREDITATA, continuava a portare l'alone da 28px dell'h1 dietro il nuovo
testo nonostante un commento nel codice dicesse il contrario -- il commento descriveva
l'intenzione, non il codice reale. Colori finali ricalcolati con `colorsys` (non a occhio) per
seguire la stessa progressione cromatica (freddo/viola nello scuro, caldo/magenta nel chiaro) già
presente in tutti gli altri gradienti del sito, invece di un viola uniforme. Bug reale trovato sul
piè di pagina: spariva su Safari per un margine di soli ~5px nel trigger del reveal-on-scroll
dell'ULTIMO elemento della pagina (tolto il reveal, ora sempre visibile). Sfondo di
`/accedi`/`/registrati`: tolta la deriva automatica ripetuta (restava solo l'interattività al
mouse). Pulsante Starter "fermo": `flow`/`sweep` troppo bassi insieme a una palette di grigi
simili tra loro, alzati allo stesso livello di Growth. Vedi la sezione dedicata più sotto per il
dettaglio completo. Aggiornamento precedente, 12/09/2026 quinto giro SECONDA PARTE (Gabriel ha
mandato screenshot presi dal suo browser reale sul sito pubblicato -- prima conferma diretta che
gli effetti `LiquidMetal` funzionano bene fuori da questa sandbox -- con 5 nuovi punti: "Crea il
tuo account" andava a capo sui pulsanti Growth/Pro (causa reale misurata con Playwright: un
margine di 0-2px, sotto la soglia del sub-pixel rendering, non un errore di layout grossolano);
titolo Hero passato a un primo tentativo di effetto "metallico" (poi superato dalla terza parte,
sopra); colore dell'anello Pro cambiato da viola/fucsia (troppo simile a Growth) a oro/champagne;
testi delle card di PerChi.tsx accorciati mantenendo tutte le card della stessa altezza; sfondo
"Spotlight scuro" di CTAFinale.tsx esteso a `/accedi` e `/registrati` (scelta lasciata al mio
giudizio). Aggiornamento precedente, 12/09/2026 quinto giro PRIMA PARTE (Gabriel ha usato il sito
pubblicato dal quarto
giro e segnalato altri 7 punti, arrivati anche a metà del lavoro di questo giro stesso -- lo
sfondo della CTA finale rifatto una seconda volta è stato mostrato con 4 opzioni via screenshot
PRIMA di scrivere codice, come richiesto esplicitamente. Bug reali risolti: FAQ e pagina di
registrazione promettevano ancora 10 giorni di prova sul piano Pro, tolto dal terzo giro --
corretti entrambi usando la stessa funzione `giorniDiProva` invece di un secondo elenco di piani
scritto a mano; le card della griglia Funzionalita comparivano tutte insieme invece che una riga
alla volta scendendo (causa reale: il reveal-on-scroll era orchestrato dal CONTENITORE, non dalle
singole card -- riscritto Reveal.tsx perché ogni card si attivi da sola in base alla propria
posizione di scroll, non più a un ritardo condiviso, effetto ora sentito su tutto il sito, non
solo lì); le card piccole della stessa griglia erano senza testo e "inutilmente alte" su
telefono -- causa reale la combinazione tra descrizione nascosta di proposito e `auto-rows-fr`
che pareggiava l'altezza di righe non correlate. Pulsanti "metal" dei piani a pagamento
ripensati come un sottile anello animato attorno a un pulsante scuro pieno, non più uno shader
che riempie tutto il pulsante (ispirazione cercata sui connettori 21st.dev/OriginKit su
richiesta di Gabriel). Vedi la sezione dedicata più sotto per il dettaglio completo. Aggiornamento
precedente, 12/09/2026 quarto giro (Gabriel ha usato il sito pubblicato dal terzo
giro e segnalato 13 nuovi punti via screenshot + testo; 4 erano scelte di design ambigue --
chiarite con `AskUserQuestion` prima di agire, come richiesto esplicitamente da Gabriel in
chiusura del suo messaggio -- le altre erano bug/rifiniture concrete. Vedi la sezione dedicata
più sotto per il dettaglio completo: griglia Funzionalita riordinata per un bug reale di
`grid-auto-flow: dense` a 3 colonne, non solo "riordinata a caso"; click-scroll di Vetrina.tsx
corretto (usava `offsetTop`, relativo all'antenato posizionato più vicino, non al documento);
card featured di PerChi spostata su "chiunque lavori su appuntamento"; TiltCard aggiunto alle
card di PercheNoi; pulsanti dei piani a pagamento con effetto LiquidMetal graduato (Starter ->
Growth -> Pro, sempre più "premium"); pulsante magnetico rimosso dalla CTA finale (disallineava
il bordo animato); scroll della navbar con easing personalizzato; nuovo header condiviso per
`/accedi` e `/registrati`; copy del riquadro verde di ImpattoEconomico riscritto una seconda
volta per nominare sia i messaggi senza risposta sia gli appuntamenti dimenticati; Reveal esteso
a `Footer.tsx` e alla didascalia di `PrimaDopo.tsx`, le uniche porzioni di testo rimaste ferme).
Aggiornamento precedente, 12/09/2026 terzo giro (Gabriel ha scaricato e usato lui stesso il sito
pubblicato dal secondo giro, con screenshot alla mano, e segnalato 10 problemi puntuali --
3 dei quali decisioni di prodotto vere (scope multi-canale AI, trial ristretto a Growth,
contenuto/Lampada di PercheNoi), non solo estetiche: vedi DECISIONS.md, voce omonima, e la
sezione dedicata più sotto per il dettaglio completo. Chiuso anche il controllo di coerenza
generale richiesto esplicitamente da Gabriel -- PIANO.md/DECISIONS.md/PROJECT_STATUS.md contro
il codice reale, vedi "Controllo di coerenza" più sotto). Aggiornamento precedente, 12/09/2026
secondo giro (Gabriel ha usato il sito pubblicato e segnalato
15 problemi puntuali dopo averlo provato di persona; lavorato con domande di chiarimento prima
di agire e opzioni mostrate prima di ogni redesign visivo, come richiesto esplicitamente. Cambio
di fondo: rimosse tutte le etichette "in arrivo"/"nel roadmap" dalla landing -- il sito ora
descrive il prodotto al lancio commerciale, non lo stato di oggi (vedi DECISIONS.md). Bug reali
diagnosticati e risolti con verifica strumentale (non a occhio): FAQ laggose/che si allargavano
su desktop (due cause distinte, vedi sezione dedicata sotto), sfondo Hero che non reagiva al
mouse su quasi tutto lo schermo, click navbar senza scroll fluido, un hydration mismatch
introdotto e poi trovato/corretto nello stesso giro. Tre sezioni riscritte con una bento grid
asimmetrica dopo aver mostrato le opzioni a Gabriel (Funzionalita, PerChi, e la timeline di
PercheNoi). Vedi la sezione dedicata più sotto per il dettaglio completo -- 112/112 test, build
pulita, zero console error in uno scroll reale completo, desktop e mobile). Aggiornamento
precedente, 12/09/2026 primo giro (sessione di controllo visivo e rifinitura pre-pubblicazione
della landing page, richiesta esplicita di Gabriel prima di andare a dormire, lavorata in piena
autonomia: verificata dal vivo con Playwright -- desktop E mobile, scroll reale simulato passo
per passo, non salti bruschi -- l'intera pagina dall'inizio alla fine; risolto un bug reale di
scroll-jacking che rendeva 4 delle 6 scene della "Vetrina" **irraggiungibili su mobile**; rifatta
da zero la sezione calcolo economico come vera sezione a due colonne con numero animato;
aggiunta una FAQ pre-footer; portate `/registrati` e `/accedi` (le pagine dove si converte
davvero) dallo stile HTML grezzo di default allo stesso linguaggio visivo premium del resto del
sito; rimossa ogni traccia da "demo"/"in costruzione" ancora visibile pubblicamente -- vedi la
nuova sezione dedicata più sotto per il dettaglio completo. Vedi anche l'aggiornamento
precedente, sotto, per lo stato del backend/prodotto, che oggi non è stato toccato). Aggiornamento
precedente, 11/09/2026 (fuso orario reale del tenant risolto e verificato dal vivo;
Apple/iCloud CalDAV probabilmente inutilizzabile da Vercel per un blocco lato Apple sugli IP di
data center -- vedi problema noto #14 -- Google Calendar resta il canale affidabile; Fase 4,
pagina pubblica del salone, codice scritto e testato ma non ancora verificato dal vivo -- vedi
sotto; nuova landing page di marketing (`/`) scritta da zero, poi ampliata una seconda volta lo
stesso giorno su feedback esplicito di Gabriel ("fa schifo, manca fluidità/interattività") --
ora copre l'intero set di funzionalità (attuali + pianificate, marcate oneste "in arrivo"),
con pattern ispirati sia ad Aceternity sia a Magic UI (vedi `docs/librerie-ui.md`) -- verificata
dal vivo in-sandbox con Playwright, poiché non dipende da Supabase). Aggiornare questo file ogni volta che cambia lo stato
reale di qualcosa (una funzionalità passa da mock a vera, un problema si apre/chiude, una fase
si chiude) — non lasciarlo invecchiare. Vedi `CLAUDE.md` per le regole di lavoro, `DECISIONS.md`
per il perché delle scelte architetturali, `PIANO.md` per il piano a fasi.

## In una riga

Fase 0 (fondamenta multi-tenant) e Fase 1 (booking engine collegato al database) **chiuse e
verificate dal vivo con un salone di test reale**. Fase 2 (AI conversazionale): il loop completo
MESSAGGIO -> AI -> strumenti -> booking engine -> risposta **funziona ed è stato verificato dal
vivo**, inclusi gli scenari di conversazione ambigua/interrotta/trasferimento a operatore --
resta da fare solo WhatsApp/Telegram (bloccato su business verification Meta). Fase 3: CRM di
base e dashboard con metriche reali/insight **chiusi e verificati dal vivo**; analytics più
avanzate non ancora iniziate. Fase 5: struttura piani (Free -> Enterprise) decisa con Gabriel e
**applicata tecnicamente** (gate AI per piano, quota mensile, anti-burst, tetto prenotazioni
Free) -- **Stripe checkout/webhook/customer portal collegati anche tecnicamente** (11/09/2026
sera, vedi sotto), non ancora verificati dal vivo con un pagamento di test reale; manca ancora
il pannello admin. Fase 6bis (fuori dai 33 punti originali, aggiunta su richiesta di Gabriel):
sincronizzazione calendario personale dell'operatore, direzione import/blocco, costruita per
entrambi i provider ma **verificata dal vivo solo per Google** (funziona) -- **Apple/iCloud via
CalDAV è tecnicamente corretto (client verificato via test comparativo diretto con `curl`) ma
probabilmente inutilizzabile in produzione perché Apple sembra bloccare il traffico CalDAV che
arriva da IP di data center/cloud come quelli di Vercel** (problema noto #14, non risolvibile
lato nostro senza un proxy con IP non-datacenter). La direzione export (mostrare gli appuntamenti
del salone sul calendario personale) non ancora scritta per nessuno dei due. Fase 4 (pagina
pubblica per-attività, punto 15): **codice scritto e testato l'11/09/2026** (`/s/[slug]`,
prenotazione self-service, widget chat AI) ma **non ancora verificato dal vivo in un browser
reale** -- da fare dopo il deploy (vedi sopra il perché). Landing page di marketing (`/`, fuori
dai 33 punti originali, richiesta esplicita di Gabriel l'11/09/2026, ampliata lo stesso giorno
su suo feedback): **scritta e verificata dal vivo in-sandbox** (nessuna dipendenza da Supabase,
quindi verificabile qui con Playwright) -- sezioni Hero (parola che ruota tra salone/studio/
centro/spazio, anteprima animata del prodotto, sfondo a fasci di luce), un "MacBook scroll"
del dashboard vero, un confronto prima/dopo trascinabile, Come funziona, una "vetrina"
scroll-driven (GSAP `ScrollTrigger` pin+scrub) estesa a 6 scene che copre TUTTO il set di
funzionalità (il sito descrive il prodotto al lancio commerciale, non lo stato di oggi -- vedi
DECISIONS.md), una sezione "perché questo" con i differenziatori reali (senza nominare
concorrenti, deciso con Gabriel) e una timeline verticale del flusso, una bento grid asimmetrica
di tutte le funzionalità, per-chi (bento grid, 6 categorie incluso un "chiunque altro"),
prezzi (dati reali da `DECISIONS.md`, piano consigliato con bordo animato), CTA finale con
sfondo a particelle. Dettagli tecnici e libreria di pattern riusabili (Aceternity + Magic UI)
in `docs/librerie-ui.md`. Tutto il resto (automazioni, PWA, Stripe/checkout) non ancora
iniziato.

## Sessione di rifinitura pre-pubblicazione della landing page (12/09/2026)

Richiesta di Gabriel (in italiano, mentre andava a dormire): non una revisione del codice, ma
un vero giro da utente reale su desktop e mobile, sezione per sezione, per portare la landing
page (`/`, `/registrati`, `/accedi`) da "funziona" a "pubblicabile e vendibile". Lavorato in
piena autonomia, senza fermarsi a chiedere conferma (istruzione esplicita di Gabriel). Metodo di
verifica: Playwright headless, screenshot presi con **scroll simulato a piccoli passi (90px,
35ms di pausa)** invece di salti bruschi di `scrollTo` -- i salti bruschi producevano falsi
allarmi su componenti animati con Framer Motion/GSAP (pannelli che sembravano "sanguinare",
scene che sembravano vuote) che sparivano completamente con uno scroll realistico. Lezione da
tenere per le prossime sessioni di QA visivo su questa pagina.

**Bug reale trovato e risolto -- Vetrina mobile (il problema più grave dei 12 punti di
Gabriel)**: la showcase a 6 scene (`Vetrina.tsx`) usa GSAP `ScrollTrigger` con `pin: true` per
l'effetto "fermo mentre scrollo" su desktop. Su mobile lo stesso pin restava attivo, ma lo stack
di card sotto (più alto della viewport) diventava `position: fixed` per l'intera durata dello
scroll-trigger -- di fatto **4 delle 6 scene non erano mai raggiungibili scrollando su
telefono**, il contenuto sotto il fold restava tagliato fuori per sempre. Confermato dal vivo
esattamente il sintomo descritto da Gabriel ("da telefono fa pena, poco equilibrata, non
funziona bene durante lo scroll" -- lui parlava della sezione "Un unico motore...", che è
scena 1 di questa stessa Vetrina). Fix: `gsap.matchMedia()` scopes il pin SOLO a `min-width:
1024px` (stesso breakpoint `lg:` di Tailwind); su mobile la stessa Vetrina ora renderizza un
layout completamente diverso, non semplicemente ridimensionato -- 6 card verticali (`Reveal`
one-shot, nessun pin, nessuno scroll-jacking), ciascuna con titolo/testo/badge "in arrivo" e
un mock-schermo dedicato (`h-64` invece di `h-full`), tutte e 6 ora effettivamente raggiungibili
scrollando normalmente. Verificato dal vivo: tutte e 6 le scene visibili e leggibili su
schermata 390px. La scena 1 (motore di prenotazione) aveva anche il problema visivo separato
segnalato da Gabriel ("quel quadrato è brutto e poco utile") -- sostituita con una vera
illustrazione ("engine hub": 3 nodi etichettati Calendario/Pagina pubblica/Assistente AI, punti
animati sui connettori, cerchio centrale rotante) che riusa lo stesso linguaggio visivo del
flusso animato già esistente in `PercheNoi.tsx`, invece di uno spazio vuoto.

**Calcolo economico, da riga di testo a sezione vera**: era una singola riga (icona + frase +
disclaimer) appesa in fondo a `PrimaDopo.tsx` -- vero nel contenuto ma con un peso visivo
minuscolo per l'argomento di vendita più importante della pagina. Estratto in
`ImpattoEconomico.tsx`, sezione propria a due colonne: a sinistra le 3 ipotesi dichiarate
scomposte come i passaggi di un calcolo (1 messaggio/settimana × 35€ scontrino medio × 52
settimane) con disclaimer esplicito invariato ("calcolo illustrativo... il prodotto non è
ancora live"); a destra un numero che conta verso l'alto quando entra in vista (`animate()` +
`useInView` di Framer Motion, non un valore statico) e un confronto ROI diretto col prezzo
reale del piano Growth (`€478,8/anno`, preso da `DECISIONS.md`/`Prezzi.tsx`, non inventato).
Nessun dato nuovo, nessuna cifra reinventata -- stesso calcolo onesto, mostrato con il peso
che merita.

**FAQ aggiunta** (`Faq.tsx`, suggerita esplicitamente da Gabriel come "se ritieni che serva"):
7 domande pre-footer, accordion con una sola voce aperta alla volta, tutte risposte già vere
altrove sul sito (nessun fatto nuovo) -- copre gli attriti tipici pre-conversione: serve sapere
di tecnologia, si può provare gratis, si può disdire, l'AI sbaglia mai, funziona su WhatsApp
(onestamente segnalato "in arrivo"), sicurezza dati (isolamento reale + hosting EU), migrazione
da un gestionale esistente.

**Rimosso ciò che tradiva "demo"/"in costruzione"**:
- `/registrati` e `/accedi` erano rimasti HTML grezzo non stilizzato fin dalla Fase 0 -- le
  uniche due pagine dove un visitatore mette davvero email/password, invisibili finché non ci
  si arriva navigando, quindi mai notate durante le sessioni precedenti focalizzate sulla
  landing. Restilizzate da zero (stesso sfondo `bg-noir` + `Grana`, stessa card con bordo/blur,
  stesso pulsante a pillola bianco) **senza toccare la logica** (stessa chiamata Supabase, stessi
  hook, stesso query param `piano`) -- verificato leggendo il file intero dopo ogni modifica.
- 404 di default di Next.js (pagina bianca non brandizzata) sostituita con `not-found.tsx` sullo
  stesso linguaggio visivo del resto del sito.
- La route di test `/prova-chat/[slug]` (widget chat isolato, usata solo per sviluppo) era
  ancora pubblicamente raggiungibile e senza alcuno stile -- non cancellabile per un blocco del
  classificatore di sicurezza dell'ambiente su `rm -rf` (anche se il file era dentro la sandbox
  effimera, non sul Mac di Gabriel); soluzione non distruttiva equivalente: il file ora chiama
  solo `notFound()`, la route risponde 404 come se non esistesse, cronologia git intatta.

**Altri fix minori trovati durante il giro**:
- Bug reale di prima parola invisibile nell'header Hero (`FlipWords.tsx`): Chromium non
  dipingeva il primissimo frame della parola che ruota (subito dopo il caricamento) quando è
  sopra lo shader WebGL dell'Hero -- confermato con screenshot Playwright a 500ms dal load, e
  poi confermato risolto interrogando via `page.evaluate()` gli stili computati del vero
  `motion.span` (non lo spacer invisibile che riserva lo spazio, con cui il primo tentativo di
  diagnosi si era confuso). Fix: `initial={false}` sull'`AnimatePresence` -- la primissima
  parola non anima più il proprio ingresso (nasce già a `opacity:1`), eliminando la finestra in
  cui Chromium poteva saltare il paint.
- Il CTA primario dell'Hero puntava ancora a `/registrati`, mentre il CTA della Nav era già
  stato allineato a fare scroll fino a `#prezzi` in una sessione precedente -- disallineamento
  minore ma reale nel percorso di conversione, corretto.
- Rivista tutta la pagina una seconda volta dopo tutti i fix sopra (desktop e mobile, scroll
  reale) per il "controllo finale" richiesto esplicitamente da Gabriel: nessun altro problema
  di layout/overflow/contrasto/spaziatura trovato, sezione per sezione, incluse le pagine
  `/registrati`, `/accedi`, 404 mai verificate visivamente prima d'ora.

**Non toccato in questa sessione (deliberatamente, fuori scopo)**: nessun cambiamento al
backend/prodotto (dashboard, booking engine, AI, calendari) -- vedi la sezione precedente per
quello stato, invariato. Rimane in repo, non cancellabile per lo stesso blocco del
classificatore citato sopra, del codice morto e mai collegato a nessuna route:
`src/components/primitives/*` e `src/app/beautifui/*` -- basso rischio (non raggiungibile da
nessun link pubblico), ma andrebbe rimosso a mano da Gabriel con un `rm -rf` dal Terminal reale
del Mac quando ha un minuto, per tenere il repo pulito.

## Secondo giro di rifinitura landing, dopo revisione dal vivo di Gabriel (12/09/2026)

Gabriel ha usato il sito pubblicato e segnalato 15 problemi puntuali, più la richiesta di
verificare tutto contro gli md prima di agire e di non lavorare di fretta. Prima di correggere
qualunque cosa, sono state fatte domande di chiarimento esplicite (incluso un rischio reale
segnalato PRIMA di agire, vedi DECISIONS.md "Il sito descrive il prodotto al lancio, non lo
stato di oggi") e per 5 sezioni (redesign visivi) sono state mostrate le opzioni prima di
implementare, come richiesto.

**Decisione di fondo, cambia il linguaggio di tutta la landing**: rimosse tutte le etichette
"in arrivo"/"nel roadmap" (Prezzi, Vetrina, Faq, Funzionalita, ImpattoEconomico) -- il sito ora
descrive il prodotto al lancio commerciale, non lo stato di oggi. Dettagli, rischio esposto a
Gabriel e sua decisione finale in DECISIONS.md, voce omonima. Stessa voce copre anche: calendario
solo Google (landing E prodotto vero -- Apple era già stato tolto dalla UI reale l'11/09/2026,
qui allineata anche la landing).

**Bug reali diagnosticati con verifica strumentale, non a occhio** (tutti confermati con
Playwright, non solo letti nel codice):
- FAQ laggose e che si allargavano su desktop: due cause distinte. (1) Framer Motion che anima
  `height: "auto"` deve ri-misurare il layout ad ogni frame -- sostituito con un'altezza in
  pixel misurata via `ref` una volta sola. (2) l'apertura di una voce spingeva l'altezza pagina
  oltre la viewport, facendo comparire la scrollbar verticale (macOS con mouse la mostra sempre)
  e restringendo di colpo la larghezza disponibile -- risolto con `scrollbar-gutter: stable` in
  `globals.css`, che riserva sempre lo spazio.
- Sfondo Hero (`LiquidMetal.tsx`) che non reagiva al mouse: diagnosticato puntando il mouse via
  script e leggendo `document.elementFromPoint` in più punti della hero -- il blocco di
  testo/bottoni sopra lo sfondo, pur trasparente, aveva `pointer-events: auto` di default e
  "rubava" il movimento del mouse su quasi tutta l'area (reagiva solo nei margini vuoti ai lati,
  strettissimi o assenti su un laptop). Fix: quel contenitore è ora `pointer-events-none`, solo
  la riga dei due bottoni riattiva `pointer-events-auto`. Corretta anche una lieve sfocatura del
  canvas (il buffer di disegno era dimensionato su `host`, ma renderizzato alla dimensione più
  grande di `wrap`, usata per il margine del tilt).
- Click in navbar che scendeva di scatto invece di scorrere fluido: `scroll-behavior: smooth` in
  `globals.css` + `scroll-mt-24` su ogni sezione con un id (compensa l'altezza della navbar
  fissa). Verificato con un timeline di scroll reale: atterra esattamente al pixel giusto anche
  attraversando le sezioni con pin GSAP di `Vetrina.tsx`.
- Hydration mismatch reale introdotto durante questo stesso giro (trovato scorrendo l'intera
  pagina con un controllo automatico dei console error, non a occhio): `.toLocaleString("it-IT")`
  chiamato su un numero fisso direttamente nel render produce testo diverso tra server e browser
  quando Node non ha i dati ICU completi ("1820" vs "1.820"). Fix: per i valori statici la
  stringa formattata è scritta una volta come costante, non ricalcolata ad ogni render; il
  contatore animato (che parte da 0 e cambia solo lato client dopo il mount) non ne risente ed è
  stato lasciato invariato.

**Redesign visivi, mostrate le opzioni prima di implementare (come richiesto)**:
- `Funzionalita.tsx`: tolta la separazione "disponibili"/"in arrivo" (non più necessaria dopo
  la decisione sopra) e la lunga lista a colonna singola su telefono ("devo scorrere tantissimo"
  di Gabriel) sostituita da una bento grid asimmetrica -- 4 riquadri grandi per i pilastri del
  prodotto (calendario, AI multicanale, dashboard, promemoria), gli altri compatti (solo
  icona+titolo su telefono, descrizione completa da tablet in su). Altezza sezione su schermo da
  390px scesa del 19% col solo secondo intervento (2490px, da 3071px del primo tentativo).
- `PercheNoi.tsx`: il flusso "1-2-3" con un pallino che correva avanti e indietro all'infinito
  senza un vero motivo per farlo ("i tre punti non hanno senso" di Gabriel) sostituito da una
  timeline verticale ferma con linea tratteggiata, che comunica sequenza invece che
  caricamento.
- `PrimaDopo.tsx`: stessa interazione di trascinamento (voluta, non sostituita), vestito
  rifinito -- bordo animato (`GlowBorder`, stesso linguaggio del piano Consigliato), maniglia con
  icona di drag riconoscibile e ombra, piccolo "wiggle" automatico al primo caricamento per
  segnalare che è trascinabile (rispetta `prefers-reduced-motion`).
- `PerChi.tsx`: stessa logica bento di `Funzionalita.tsx` per coerenza visiva sitewide -- il
  pubblico principale (saloni/parrucchieri con team) in un riquadro doppio, e una sesta voce
  "Qualunque attività lavori su appuntamento" aggiunta su richiesta esplicita di Gabriel
  ("basta che attiri tutte le persone che prendono appuntamenti"). Titolo riscritto senza "non
  solo per i saloni" (suonava come una scusa, non un motivo per convincere).

**Verifica finale**: 112/112 test passano, `tsc --noEmit` pulito, `eslint` pulito, build di
produzione pulita, zero console/page error in uno scroll reale completo della pagina (desktop E
mobile, non solo un controllo visivo) dopo tutte le modifiche insieme.

**Non ancora fatto da questa sessione**: audit "false promesse" (punto 11) fatto -- nessun
form/input/toggle finto trovato nel codice, i mockup sono tutti dichiarati come illustrazioni
non cliccabili nei commenti; sweep generale di spaziatura/allineamento (punto 14) fatto solo sul
titolo di PerChi (esempio esplicito di Gabriel), non su tutta la pagina voce per voce. Prossimo
passo: commit + bundle + consegna a Gabriel per il pull sul suo Mac.

## Terzo giro di rifinitura landing, dopo che Gabriel ha usato lui stesso il sito (12/09/2026)

A differenza dei due giri precedenti (revisione a schermo di Claude via Playwright), stavolta
Gabriel ha scaricato il bundle del secondo giro, l'ha usato sul proprio Mac e ha mandato
screenshot reali con 10 segnalazioni puntuali. Dettaglio completo delle 3 decisioni di prodotto
vere in DECISIONS.md (voce "Seconda revisione landing"); qui il riepilogo tecnico.

**Bug di layout reali, diagnosticati e non solo ritoccati a occhio**:
- `Funzionalita.tsx` e `PerChi.tsx`: buco strutturale nell'angolo in basso a destra della bento
  grid, confermato dal vivo con Playwright a più larghezze. Causa reale (non un problema di
  `grid-auto-flow: dense`, che chiude solo i buchi lasciati da un riquadro doppio fuori posto):
  il totale delle "unità" di griglia (1 per riquadro normale, 2 per doppio) non era multiplo del
  numero di colonne ad alcuni breakpoint -- 19 unità su 4 colonne per Funzionalita, 7 unità su 4
  colonne per PerChi -- quindi l'ultima riga restava sempre incompleta, qualunque fosse l'ordine
  degli elementi. Fix: portato il totale a un multiplo pulito in entrambi i file (20 e 8 unità)
  promuovendo "CRM clienti" a riquadro doppio in Funzionalita (è comunque uno dei pilastri veri
  del prodotto) e aggiungendo una settima categoria vera ("Fotografi e studi fotografici") in
  PerChi -- non un riquadro vuoto o un riempitivo senza senso. Verificato a 1440px, 800px, 390px:
  nessun buco in nessuna delle due griglie a nessuna larghezza testata.
- `ImpattoEconomico.tsx`, riga del promemoria automatico: `pl-14` (allineamento con le righe
  formula sorelle) combinato con un'icona dentro un `flex` proprio spostava il testo ~22px più a
  destra delle righe sorelle, e centrava verticalmente l'icona sull'intero blocco quando il testo
  andava a capo su più righe -- da cui "va a capo ed è spostata a destra" di Gabriel. Fix:
  l'icona è tornata un elemento inline dentro lo stesso identico `<p className="pl-14">` delle
  righe sorelle, non un figlio di un flex separato -- stesso indentamento sempre, testo che va a
  capo come un paragrafo normale. Verificato a 1440px e 375px.
- Hero: nessun vero bug (il mockup del prodotto e la sezione ProdottoScroll sotto sono entrambi
  corretti/intenzionali -- risposta diretta alla domanda di Gabriel "la dashboard è corretta?":
  sì), ma un taglio visivo netto reale tra lo shader colorato `LiquidMetal` della Hero e il
  `bg-noir` piatto di `ProdottoScroll` subito sotto, proprio all'altezza del mockup del prodotto.
  Fix: fade in gradiente (`from-transparent to-noir`) negli ultimi ~8rem della Hero. Verificato
  con uno screenshot a cavallo esatto del confine tra le due sezioni.
- `Vetrina.tsx`, scena chat (indice 2): bug reale di sequenza, non di stile -- la domanda e le
  due righe di risposta erano semplici `<div>` senza alcuna animazione (comparivano quindi tutte
  al montaggio, istante 0), mentre solo l'indicatore "sta scrivendo" aveva un'animazione, in loop
  infinito, sopra risposte già visibili da subito. Riscritta come sequenza vera con `delay`
  crescenti (domanda -> indicatore -> risposte). Verificato con 3 screenshot temporizzati (t=0.2s,
  t=1.1s, t=2.5s): l'ordine ora è esattamente quello richiesto.

**Decisioni di prodotto/copy** (dettaglio completo in DECISIONS.md): scope AI multi-canale
ristretto a "chat e WhatsApp" nel copy attuale (Instagram/Telegram restano un obiettivo futuro,
tolti da Funzionalita.tsx e dalla voce Enterprise di Prezzi.tsx, sostituita con "Multi-sede e
ruoli avanzati"); trial di 10 giorni ristretto al solo piano Growth (Prezzi.tsx **e**
`giorniDiProva` in `src/lib/stripe/piani.ts` -- comportamento Stripe reale, non solo testo,
test aggiornato in `piani.test.ts`); riquadro verde di ImpattoEconomico riscritto senza citare
il prezzo di Growth, con un argomento di vendita (evita perdite + aumenta l'incasso) invece di
un confronto freddo; tolto il "+" ingiustificato dopo il totale animato; rimossi il flusso
numerato 1-2-3 e il bagliore viola (`Lampada`) da `PercheNoi.tsx` (contenuto duplicato con la
scena 0 di Vetrina.tsx, bagliore pensato per titoli senza griglia sotto -- qui la griglia
DIFFERENZIATORI c'è sempre stata). TiltCard aggiunto alle card di Funzionalita.tsx (mancava
rispetto a PerChi.tsx) e titolo della sezione centrato.

**Verifica finale**: 112/112 test passano (incluso l'aggiornamento dell'assert su
`giorniDiProva("pro")`, ora `undefined`), `eslint` pulito sui file toccati, build di produzione
pulita, zero console/page error in uno scroll reale completo (desktop 1440px e mobile 390px).
Controllo visivo con Playwright mirato esattamente sui punti segnalati da Gabriel (angoli delle
griglie, larghezze strette per il wrap del testo, screenshot temporizzati per l'animazione della
chat) invece di uno scroll generico -- lezione esplicita di questo giro: un controllo "generico"
di sezione può non bastare quando il problema è nell'angolo esatto di una griglia o nel timing
esatto di un'animazione.

**Controllo di coerenza generale** (richiesto esplicitamente da Gabriel oltre ai 10 punti):
PIANO.md, DECISIONS.md e questo file sono stati confrontati con il codice reale. Nessuna
discrepanza nuova trovata oltre a quelle già note e già segnalate in questo file (vedi "Problemi
noti aperti" e "Cosa è mock, incompleto o non ancora iniziato" -- entrambe le sezioni erano già
aggiornate correttamente ai giri precedenti). Un solo aggiornamento necessario: la sezione
"Prossimo passo pianificato" in fondo a questo file era rimasta ferma a "il codice non è ancora
committato", ma il secondo giro è già stato committato (`2ff7ea5`) -- corretta più sotto.

## Quinto giro di rifinitura landing, dopo l'uso reale del sito pubblicato dal quarto giro (12/09/2026)

Gabriel ha mandato 7 punti, alcuni via messaggi separati mentre il lavoro di questo stesso giro
era già in corso -- gestiti mano a mano, non ripartendo da capo.

**Bug reali diagnosticati e non solo ritoccati a occhio**:
- `Faq.tsx` e `registrati/page.tsx`: entrambi promettevano ancora "10 giorni di prova" sul piano
  Pro, restrizione tolta nel terzo giro (`giorniDiProva` in `piani.ts` ora ritorna `undefined` per
  Pro). La FAQ aveva semplicemente un testo statico non aggiornato; `registrati/page.tsx` era più
  serio -- un controllo scritto a mano (`pianoValido === "growth" || pianoValido === "pro"`) invece
  di usare `giorniDiProva`, la stessa funzione che il checkout Stripe reale rispetta -- avrebbe
  promesso un trial che al momento di pagare non sarebbe mai arrivato. Corretti entrambi usando
  `giorniDiProva` come unica fonte di verità.
- `Reveal.tsx`: le card di una griglia comparivano "tutte insieme" scendendo, non una riga alla
  volta (segnalazione di Gabriel). Causa reale: `RevealStagger` era l'UNICO trigger
  (`whileInView` sul contenitore), e le card figlie si limitavano a ereditare le varianti con uno
  sfalsamento (`staggerChildren`) misurato in TEMPO, non in scroll -- su una griglia alta più
  schermate lo sfalsamento totale finiva (meno di un secondo) ben prima che l'utente scorresse
  fino alle righe più basse, che quindi arrivavano già comparse. Riscritto perché ogni
  `RevealItem` si attivi DA SOLO in base alla propria posizione di scroll (stesso `whileInView`
  di `Reveal`) -- le card della stessa riga entrano in viewport quasi insieme e compaiono
  insieme naturalmente, quelle sotto restano ferme finché non ci si scorre vicino davvero.
  Cambio in un solo file, effetto su tutte le griglie del sito (Funzionalita, PerChi, PercheNoi,
  Prezzi, Faq, ComeFunziona, CTAFinale), non solo su quella segnalata.
- `Funzionalita.tsx`: le card piccole "non hanno il testo" su telefono, ed erano "troppo grandi
  verticalmente, molto inutilmente" (due segnalazioni di Gabriel, stessa causa). La descrizione
  era nascosta di proposito su telefono per le card non-pilastro (terzo giro, "su telefono devo
  scorrere tantissimo") -- ma la griglia usava `auto-rows-fr`, che senza un'altezza esplicita sul
  contenitore pareggia l'altezza di OGNI riga implicita su quella della riga più alta di TUTTA la
  griglia, non solo delle card della stessa riga: le card piccole senza descrizione si
  stiravano per pareggiare righe lontane con card "grande" a descrizione lunga, lasciando vuoto
  invece di contenuto. Tolto `auto-rows-fr` (ogni riga si dimensiona sul proprio contenuto,
  `align-items: stretch` di default resta comunque utile PER RIGA) e rimossa la descrizione
  nascosta -- ora mostrata sempre, riempiendo lo spazio che prima restava vuoto.

**Consultato prima di agire** (dettaglio in DECISIONS.md): sfondo di CTAFinale.tsx rifatto una
seconda volta -- mostrate 4 direzioni via screenshot (aurora multicolore, griglia tecnica,
spotlight scuro, piatto/minimale) prima di scrivere codice, scelto "Spotlight scuro" e reso
interattivo (segue il puntatore con uno smoothing a molla, deriva lento quando non c'è
interazione). Titolo della Hero ("mai più senza risposta"): tolto il bagliore colorato attorno al
testo (leggeva come un'"evidenziazione" indesiderata) e sostituito con un colore pieno (ambra) --
lontano su qualunque ruota cromatica dal viola/fucsia dello shader dietro, non si confonde più a
nessuna fase dell'animazione. Pulsanti "metal" dei piani a pagamento: cercata ispirazione sui
connettori (21st.dev, componente "metal-fx") su richiesta esplicita di Gabriel -- non installata
la libreria di terze parti (licenza non verificata, budget vicino a zero), ricreata la stessa
idea (un anello metallico animato attorno a un elemento, non uno shader a piena superficie) con
`LiquidMetal`, già in uso e già verificato altrove nel sito.

**Altre rifiniture**: riga del promemoria in `ImpattoEconomico.tsx` accorciata (tolto "prima
dell'appuntamento", ridondante con il titolo della colonna due righe sopra) per stare su una riga
sola a ogni larghezza testata.

**Verifica finale**: 112/112 test, `tsc --noEmit` pulito, `eslint` pulito sui file toccati, build
di produzione pulita, zero console/page error in un controllo Playwright mirato sui 7 punti
segnalati (1440px e 375px), incluso una verifica diretta via `getComputedStyle` per il colore del
titolo della Hero (lì lo screenshot da solo non basta, vedi nota sotto) e uno screenshot per
piano (`?piano=pro` vs `?piano=growth`) per confermare che la pagina di registrazione mostri il
trial solo dove esiste davvero.

**Nota per Gabriel**: gli screenshot della Hero e dei pulsanti "metal" di Prezzi restano poco
affidabili da questa sandbox per lo stesso motivo già segnalato nel giro precedente -- il
contesto WebGL qui non è mai utilizzabile (verificato di nuovo: anche lo shader della Hero, mai
toccato in questi due giri, risulta "context lost" appena caricato), quindi qualunque cosa
disegnata da `LiquidMetal` (compreso il nuovo anello metallico sui pulsanti) non è visibile negli
screenshot presi da qui. Confermato però che il codice è corretto dove verificabile
diversamente (classe CSS del colore Hero via `getComputedStyle`, struttura DOM dei pulsanti,
nessun errore console) -- il controllo visivo vero per questi due punti resta da fare sul sito
reale.

## Quinto giro, seconda parte -- Gabriel ha usato il sito vero pubblicato (screenshot da Safari, 12/09/2026)

Gabriel ha mandato 4 screenshot presi dal SUO browser (Safari, sito pubblicato reale, non questa
sandbox) sull'Hero e su Prezzi -- prima conferma diretta che gli effetti `LiquidMetal` (shader
Hero, anello metallico dei pulsanti) funzionano correttamente in un browser vero: la teoria del
"contesto WebGL rotto solo in questa sandbox" (nota sopra) è confermata corretta, nessuna
regressione reale nel codice del giro precedente.

**Bug reale diagnosticato e non solo ritoccato a occhio**: "Crea il tuo account" andava a capo su
Growth e Pro (screenshot alla mano). Misurato con Playwright, non a occhio: il testo misura ~125px
a `lg`, la colonna della griglia lasciava solo ~125-127px liberi dentro lo span dopo il padding
(`px-4`, 16px per lato) -- un margine di 0-2px, sotto la soglia dell'arrotondamento sub-pixel (per
questo in Safari reale andava a capo su 2 pulsanti su 3, non su tutti e tre: differenze di
sub-pixel tra i tre span identici). Fix: padding orizzontale ridotto (`px-4` -> `px-3`, libera 8px
per lato, margine reale ~8-10px) più `whitespace-nowrap` esplicito come rete di sicurezza.

**Richiesta esplicita di Gabriel, non ambigua** (ha specificato lui stesso l'effetto voluto,
invitando comunque a chiedere se qualcosa non fosse chiaro): titolo Hero "mai più senza risposta"
passato da colore ambra pieno a un effetto "metallico" -- riempimento scuro (antracite, non nero
puro: il nero sarebbe scomparso contro lo sfondo violaceo dello shader dietro, come lo stesso
Gabriel prevedeva) + contorno argentato per lettera via `-webkit-text-stroke` (nativo
Safari/Chrome). L'ombra propria dell'h1 (28px di sfocatura, ereditata da testo bianco sottile) è
stata sostituita con una coppia di ombre NETTE (1-4px di sfocatura, bevel chiaro sopra + profondità
scura sotto) invece di continuare a ereditare quella da 28px -- era quella la vera causa
dell'"alone sfumato" ancora segnalato dopo il primo tentativo di questo giro (il colore non era
l'unico problema: il blur del parent restava visibile dietro qualunque colore pieno). Verificato
via `getComputedStyle` (colore, stroke e ombra applicati correttamente) e via screenshot con lo
sfondo shader temporaneamente sostituito da un gradiente statico rappresentativo (solo per
verifica in sandbox, non nel codice) -- il contorno resta perfettamente leggibile, il riempimento
scuro si confonde volutamente con lo sfondo, ottenendo l'effetto "solo contorno" descritto da
Gabriel.

**Pulsanti Prezzi**: colore dell'anello Pro cambiato da oro/champagne (prima usava la stessa
palette viola/fucsia della Hero, la stessa famiglia di colore dell'anello di Growth appena sopra
-- le due leggevano come varianti dello stesso piano, non due livelli diversi). Oro è il codice
colore universale del livello "top" (carte Gold/Platinum): un'unica interruzione cromatica
dall'identità viola/fucsia del sito, usata in un solo anello sottile, riconoscibile a colpo
d'occhio come il piano più alto.

**PerChi.tsx**: testo della card "Parrucchieri e centri estetici con team" accorciato (era il più
lungo delle sette, quasi il doppio degli altri) insieme a quello delle altre sei card, per
occupare meno spazio verticale mantenendo tutte le card della stessa altezza. La griglia usa
`auto-rows-fr` (ogni riga si stira sull'altezza della card più alta di TUTTA la griglia): non è lo
stesso bug di `Funzionalita.tsx` di questo giro (lì `auto-rows-fr` causava un'altezza indesiderata
su mobile e andava rimosso) -- qui è l'effetto VOLUTO da Gabriel ("devono però essere uguali
verticalmente"), il problema era un solo testo troppo lungo che da solo dettava l'altezza di tutte
le altre sei card. Verificato via Playwright: le 7 card misurano la stessa altezza (234px a
1440px, 237px a 375px) sia prima che dopo, ma quell'altezza comune è ora molto più bassa.

**Sfondo di /accedi e /registrati** (richiesta con giudizio lasciato a me: "card in fondo
bellissima, rendi cosi anche lo sfondo di accedi e di registrati, se pensi possa migliorare,
fallo"): applicato lo stesso "Spotlight scuro" interattivo di CTAFinale.tsx al posto del vecchio
alone viola statico e fisso -- continuità visiva con il resto del sito invece di un pattern
diverso solo per queste due pagine, coerente con la preferenza già espressa da Gabriel per
un'interfaccia "fluida e dinamica". L'hook `useSpotlightScuro` è stato estratto da CTAFinale.tsx
in un file condiviso (`SpotlightScuro.tsx`) invece di duplicarlo in tre punti.

**Verifica finale**: 112/112 test, `tsc --noEmit` pulito, `eslint` pulito sui file toccati, build
di produzione pulita, zero console/page error, screenshot Playwright a 1440px e 375px per ogni
punto (pulsanti Prezzi senza più testo a capo, card PerChi accorciate e uguali tra loro, sfondo
interattivo su /accedi e /registrati che segue il mouse).

## Quinto giro, terza parte -- Gabriel guarda il sito vero e chiede di non fare più push alla cieca (12/09/2026)

Gabriel ha mandato 2 nuovi screenshot dal sito vero (Safari) e ha chiesto esplicitamente di
mandargli screenshot PRIMA di ogni prossimo push invece di scoprire i problemi solo a
pubblicazione avvenuta -- workflow cambiato di conseguenza per il resto di questo giro: ogni fix
sotto è stato verificato con uno screenshot mirato e mandato a Gabriel prima di procedere oltre,
non solo alla fine.

**Titolo Hero -- tre iterazioni, due bug reali trovati (non solo gusto estetico)**:
1. Primo tentativo di questo giro (contorno argentato sottile su riempimento scuro): bocciato con
   screenshot del sito vero alla mano ("orrendo", "l'effetto metallico è inesistente"). Causa
   reale dell'errore: avevo verificato il colore solo contro un finto sfondo scuro uniforme (lo
   sfondo di CTAFinale) mai contro quello VERO della Hero, che è un vortice chiaro e saturo, non
   scuro -- un contorno chiaro sparisce proprio dove serve di più. Corretto usando lo screenshot
   REALE di Gabriel come sfondo di prova in Playwright (canvas nascosto, l'immagine caricata al
   suo posto) invece di indovinare di nuovo un colore a occhio.
2. Riscritto con un contorno a due toni (nero fuori/argento dentro, tre copie del testo impilate
   via CSS grid) + bande di metallo vere nel riempimento (gradiente verticale chiaro/scuro,
   `background-clip: text`) + un riflesso animato sopra (`background-position` in loop, stessa
   idea di `shimmer`/`sweep` dei pulsanti ma in CSS puro -- usare lo stesso shader WebGL come
   maschera del testo è stato scartato per fragilità: il contesto WebGL non regge mai in questa
   sandbox, quindi un bug nel mask non lo scoprirei prima di Gabriel, e servirebbe far combaciare
   a pixel i metrics del font in un SVG separato per ogni breakpoint). Mandati gli screenshot --
   Gabriel: "ha uno sfondo nero ed è troppo scuro e poco metallico".
   **Bug reale**: `text-shadow` è una proprietà EREDITATA. Il commento nel codice diceva già "non
   più l'alone da 28px ereditato dall'h1", ma nessuna riga disattivava davvero quell'eredità --
   tutte e quattro le copie del testo impilate continuavano a ricevere l'ombra scura da 28px di
   sfocatura dell'h1 (pensata per un testo bianco sottile, non per queste lettere spesse e
   scure), che due delle quattro copie (riempimento opaco) rendevano perfettamente visibile: un
   alone nero enorme dietro tutta la frase che schiacciava le bande di metallo sotto. Bastava
   scrivere l'intenzione nel commento, non era stata scritta nel codice -- fix: `textShadow:
   "none"` esplicito sul contenitore (si eredita in giù su tutti i figli).
3. Tolto l'alone, le bande erano leggibili ma "non troppo marcato... di un metallico premium
   tendente al viola che si abbina allo sfondo": abbassato il contrasto delle bande (nessun
   bianco/nero puro, fascia di luminanza più stretta) e virato tutta la tinta (bande, contorni,
   riflesso) verso il viola.
4. Ultima richiesta: "verifica che si abbini allo sfondo e al colore di tutto il sito e che non ci
   siano colori migliori". Calcolato con `colorsys` (non a occhio) che i colori reali del sito
   (`violet-600` #7c3aed, il bagliore del badge "Consigliato" #f0abfc, `PALETTE_DEFAULT` di
   LiquidMetal.tsx) non sono mai un viola uniforme dal chiaro allo scuro: scuriscono verso un
   viola freddo (~262° di tonalità) e SCHIARISCONO verso un magenta/fucsia caldo (~289-293°) --
   il tentativo precedente aveva virato TUTTE le bande verso lo stesso viola freddo, catturando
   solo metà dell'identità cromatica reale del sito. Ricalcolate le bande con la stessa
   progressione (scuro freddo -> chiaro caldo, stessa direzione degli altri gradienti del sito),
   verificato con uno swatch affiancato ai colori reali del sito (screenshot mandato a Gabriel).

**Piè di pagina sparito -- bug reale**: il footer usava lo stesso "reveal on scroll"
(`whileInView` + `margin: "-80px"`) delle altre sezioni. Essendo l'ULTIMO elemento della pagina,
con altezza di ~85px, il margine di sicurezza per far scattare l'animazione era di soli ~5px --
su Safari, dove l'altezza effettiva della finestra cambia durante lo scroll (la barra degli
indirizzi si nasconde/mostra), quei 5px potevano sparire da un momento all'altro e l'observer non
scattava mai: il footer restava nel DOM ma a `opacity: 0` per sempre (il bordo superiore
`border-t` restava visibile, il contenuto no). Tolto il reveal dal footer -- un elemento di
utilità (link + copyright) non vale il rischio di un'animazione mai partita per un effetto
puramente estetico, ora sempre visibile senza dipendere da scroll/viewport.

**Sfondo di /accedi e /registrati**: "potrebbe dare fastidio e fa sempre lo stesso movimento" --
la deriva automatica in loop (pensata per CTAFinale, vista solo pochi secondi mentre si scorre)
diventava notabile e ripetitiva su un form dove si resta fermi più a lungo. Aggiunto un parametro
`derivaAutomatica` a `useSpotlightScuro` (default `true`, CTAFinale invariato) -- su
`/accedi`/`/registrati` passato `false`: resta solo l'effetto interattivo al passaggio del mouse,
nessuna animazione che si ripete da sola.

**Pulsante Starter "fermo"**: `flow` (il parametro che fa avanzare il pattern nel tempo, vedi
`LiquidMetal.tsx`) era il più basso dei tre piani (3, contro 5 di Growth e 7 di Pro) insieme a una
palette di grigi tutti simili tra loro -- il movimento c'era ma troppo lento e troppo poco
visibile (grigi vicini che si scambiano piano non si notano) per leggersi come "vivo". Alzati
`flow` e `sweep` allo stesso livello di Growth: la sobrietà di Starter resta nella PALETTE
(grigio/argento, non viola/oro), non nella velocità dell'animazione.

**Nota per Gabriel**: come nei giri precedenti, il colore reale dell'anello Pro/Starter e
l'animazione dello shader restano da verificare sul sito vero -- il contesto WebGL non regge mai
in questa sandbox. Per il titolo Hero, invece, il metodo di verifica è cambiato: non più uno
sfondo scuro indovinato a caso, ma il TUO screenshot reale usato come sfondo di prova in
Playwright (canvas nascosto, la tua immagine al suo posto) -- molto più affidabile, anche se resta
comunque un'immagine ferma, non lo shader animato vero.

## Quinto giro, quinta parte -- titolo "premium" come Growth, e clipping desktop in Vetrina (12/09/2026)

**Titolo Hero -- "prendi spunto dal colore dei pulsanti, tipo il pulsante di growth"**: dalla
terza parte in poi, il contorno e le bande di metallo del titolo usavano una tinta viola
DESATURATA di proposito ("i metalli sono desaturati per natura anche quando hanno una tinta" --
ragionamento corretto in astratto, ma non quello che Gabriel stava chiedendo). Guardando il
titolo accanto al pulsante Growth vero, Gabriel ha chiesto esplicitamente gli stessi colori
SATURI di quel pulsante, non un'interpretazione "metallica" più tenue. Cambiamenti, tutti con i 4
colori esatti di `METAL_PIANI.Growth.colors` (`#2e1065`, `#4c1d95`, `#7c3aed`, `#c026d3`) come
unica fonte, passati per `colorsys` invece che scelti a occhio:
- Contorno esterno portato a `#110722` (più scuro del più scuro di Growth, per contrasto);
  contorno interno portato a `#efc1f6` (il fucsia più chiaro di Growth, schiarito ulteriormente).
- Riempimento delle bande: non più un gradiente morbido da un capo all'altro, ma le 4 tinte di
  Growth ripetute con uno schema chiaro-scuro-chiaro-scuro (9 stop) -- la stessa tecnica usata per
  il "testo cromato" nel web design: più passaggi chiaro/scuro leggono come più superfici che
  riflettono la luce a angolazioni diverse, cioè più "lucido".
- Riflesso animato: nucleo schiarito a quasi-bianco (prima era lilla tenue, troppo debole) e
  `mixBlendMode` cambiato da `"overlay"` a `"screen"` -- `overlay` scurisce le zone già scure della
  banda sotto (contro-intuitivo per un riflesso, che dovrebbe sempre illuminare), `screen`
  schiarisce sempre a prescindere dal colore sotto.

**Vetrina.tsx -- lo stesso bug del pin mobile, ripresentato su desktop**: Gabriel ha mandato uno
screenshot della sezione "Perché è diverso" con l'ultima voce della lista ("Il tuo calendario
personale, sempre sincronizzato") tagliata in basso -- "anche questo viene tagliato", lo stesso
linguaggio usato per il bug delle lettere "p" del titolo pochi minuti prima. Causa reale,
diagnosticata leggendo il codice: la sezione usa GSAP ScrollTrigger con `pin` per tenere fermo un
"palco" (mockup del prodotto) mentre si scorre una lista di 6 voci a fianco -- lo stesso pattern
già causa di un bug IDENTICO su mobile (vedi "Quinto giro" più sotto), risolto allora dando al
mobile un layout completamente diverso, non pinnato. L'assunzione scritta in quel fix ("su
desktop il layout a 2 colonne è molto meno alto, il pin ci sta") era vera in media ma non sempre:
la lista di 6 pulsanti-scena, con titolo+descrizione+icona ciascuno, supera comunque l'altezza
della finestra su schermi non altissimi -- e l'intera griglia (lista + palco) veniva pinnata
insieme, quindi qualunque parte oltre il bordo inferiore della finestra restava permanentemente
irraggiungibile per tutta la durata del pin, esattamente come su mobile.

Fix (non un ritocco, una correzione strutturale): pinnare SOLO il palco di destra (piccolo,
altezza fissa 20-26rem, entra in qualunque finestra ragionevole) invece dell'intera griglia; la
lista di sinistra diventa `position: sticky` con `overflow-y-auto` + `max-height` legato alla
viewport come rete di sicurezza (se in futuro dovesse comunque superare lo spazio disponibile,
scorre con la rotella invece di tagliare l'ultima voce -- non più "mai raggiungibile", sempre
raggiungibile).

Verificato con Playwright che questa scelta NON fosse solo corretta sulla carta, con uno scroll
reale (non un salto istantaneo) sono emerse due insidie che la sola lettura del CSS non avrebbe
mostrato:
1. `position: sticky` smetteva di agganciarsi dopo pochi pixel di scroll. Causa: il contenitore
   diretto della lista aveva altezza automatica (quella del contenuto, ~900px) invece dei 5400px
   di scroll assegnati alle 6 scene -- lo spazio in cui la lista poteva restare "attaccata" era
   cortissimo. Fix: quel contenitore eredita l'altezza piena (`h-full`) del blocco di scroll da
   5400px.
2. Con quella correzione, `items-center` (per centrare verticalmente le due colonne) centrava il
   PALCO di destra a metà di una riga alta 5400px -- cioè circa 2700px sotto la cima della
   sezione, fuori da qualunque finestra. GSAP calcola dove "congelare" un elemento pinnato dalla
   sua posizione naturale nell'istante in cui lo pinna: il palco veniva quindi pinnato a
   `top: 2564px`, invisibile per l'intera sezione (bug nuovo, introdotto dal fix del punto 1,
   trovato anch'esso solo scrollando davvero e leggendo la posizione reale dell'elemento, non
   supponendola). Fix: `items-start` al posto di `items-center` sulla riga -- il palco nasce in
   cima, dove GSAP lo pinna in un punto visibile.

Verifica finale (scroll programmato attraverso l'intero intervallo, non solo 2-3 screenshot a
caso): tutte e 6 le voci della lista sempre visibili e raggiungibili; il palco di destra sempre
nella stessa posizione a schermo; il contenuto del palco e l'URL nella barra corrispondono sempre
alla voce evidenziata nella lista, verificato a 6 punti di scroll distinti (inizio, 20%, 45%, 60%,
75%, fine).

`tsc --noEmit`, `eslint` sui file toccati, `vitest run` (112/112) e `next build` tutti puliti.

## Quinto giro, quarta parte -- ancora titolo Hero e pulsante Pro, sul sito vero (12/09/2026)

Gabriel ha guardato di nuovo il titolo Hero e il pulsante Pro dopo la consegna della terza parte
e ha segnalato 5 punti in un solo messaggio: "carino ma un po brutto da vedere, troppo spento...
rallenta l'animazione e migliorala, poi ce ancora lo sfondo sfumato scuro dietro la frase, e le p
sono tagliate sotto... il pulsante di pro tende ancora al verde, fa un po oro e un po verde, fai
solo oro".

**"Le p sono tagliate sotto" -- bug reale, non gusto estetico**: la seconda riga del titolo
("mai più senza risposta.") entra in scena scorrendo su dal basso, tecnica standard --
`<span className="overflow-hidden">` esterno che ritaglia, `<motion.span>` interno che trasla da
`y: "110%"` a `y: "0%"`. Il contenitore esterno si dimensiona esattamente sull'altezza della riga
di testo secondo il `line-height` ereditato dall'h1 (`leading-[1.08]`, volutamente stretto per un
titolo compatto). Il layout del browser calcola quell'altezza dai metrics del FONT, ignorando
completamente che `-webkit-text-stroke: 4px` (il contorno esterno più spesso delle due copie
impilate) dipinge ~2px oltre il bordo naturale di ogni lettera in OGNI direzione, comprese le
discendenti (p, g, q) che su un line-height già stretto avevano pochissimo margine sotto per
cominciare. Il risultato: quei 2px in più di contorno finivano oltre il bordo del contenitore e
venivano tagliati via dall'`overflow-hidden`, tranciando la codina delle "p" di "più" e
"risposta". Fix: aggiunto `paddingBottom` al contenitore esterno di quella riga (non toccato il
`line-height` condiviso con la prima riga del titolo "Il tuo salone,", per non spostarla) --
padding sul contenitore che clippa dà lo spazio in più senza cambiare come il testo viene
impaginato. Verificato con screenshot ravvicinati, desktop e mobile (dove la riga va a capo su
due righe reali): "più" e "risposta." ora escono per intero.

**"Ce ancora lo sfondo sfumato scuro dietro la frase" -- secondo bug reale, distinto da quello
già corretto nella terza parte**: la terza parte aveva già trovato e corretto un `text-shadow`
ereditato dall'h1 che restava attivo sulle copie di testo impilate (fix: `textShadow: "none"`).
Restava però un SECONDO effetto separato, mai toccato perché sembrava innocuo: un
`filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55))` messo apposta sul contenitore per dare
profondità alla scritta senza triplicarsi su ognuna delle quattro copie di testo impilate (a
differenza di `text-shadow`, che si eredita su ciascuna). Anche con un raggio di sfocatura
modesto (5px) e opacità non altissima, un'ombra scura sopra lo sfondo chiaro e saturo della Hero
resta visibile come una vera e propria "sfumatura scura" intorno alla frase -- l'occhio la legge
come un alone, non come profondità, esattamente come descritto da Gabriel. Tolto del tutto: le
due copie di contorno (nero spesso fuori, argento chiaro dentro) danno già abbastanza contrasto
e leggibilità su qualunque fase dello shader dietro, senza bisogno di un'ombra portata aggiuntiva.

**"Troppo spento" -- colori ricalcolati una quarta volta**: la tonalità (freddo/viola nello
scuro -> caldo/magenta nel chiaro, calcolata con `colorsys` sui colori reali del sito) era già
corretta dalla terza parte, ma il range di luminosità/saturazione restava troppo compresso verso
il centro -- leggibile ma piatto. Ricalcolato con la STESSA progressione di tonalità (nessun
colore nuovo inventato a occhio) ma un range più ampio: gli stop scuri scendono più vicino al
nero, quelli chiari salgono più vicino al bianco caldo, saturazione alzata su tutti gli stop --
più contrasto interno alle bande senza diventare un viola acceso da neon.

**"Rallenta l'animazione e migliorala"**: la velocità del riflesso che attraversa il testo era
già stata rallentata (da 3.2s a 6s per passata, pausa da 1.4s a 2.2s) in un intervento precedente
di questo stesso giro. Il "migliorala" riguardava la FORMA del riflesso: prima una fascia stretta
a bordi netti (transparent -> pieno -> transparent in soli tre stop, un "lampo" che si accende e
spegne di scatto), ora una curva a campana più larga e morbida (sei stop, un nucleo più stretto e
una dissolvenza ai lati più graduale) -- si accende e si spegne con dolcezza, più vicino a un vero
riflesso di luce su una superficie lucida.

**"Il pulsante di pro tende ancora al verde, fa un po oro e un po verde, fai solo oro" -- bug
reale, diagnosticato leggendo lo shader, non a occhio**: `LiquidMetal.tsx` ha una funzione
`hueShift()` che ruota la tonalità dell'INTERA palette avanti e indietro nel tempo --
`uHue = sin(shimmerPhase) * shimmer * 0.05` radianti, con `shimmerPhase` che avanza a velocità
COSTANTE (il parametro `shimmer` controlla solo l'AMPIEZZA della rotazione, non la sua velocità).
Con `shimmer: 7` (il valore di Pro) l'ampiezza è ±0.35 rad ≈ ±20°: la tonalità oro della versione
precedente (~31-42°, calcolata con `colorsys` nella seconda parte) con una rotazione di +20°
finiva a ~51-62°, già dentro la zona percepita come giallo-verde/senape (il confine tra "oro
caldo" e "verde" cade molto prima dei 120° del verde puro) -- da qui l'oscillare tra oro e verde
segnalato da Gabriel. Ricalcolata un'altra volta con `colorsys`, stavolta con tonalità molto più
basse (~22-34° invece di ~31-42°, più vicine all'arancio-ruggine) in modo che anche il picco
massimo della rotazione (fino a ~54°) resti saldamente nell'oro/ambra. Ridotto anche `shimmer` da
7 a 6 per restringere un po' l'ampiezza stessa della rotazione, restando comunque sopra il 5 di
Growth. **Non verificabile in questa sandbox** (il contesto WebGL non rende mai in modo affidabile
qui, confermato anche in questo giro: le stesse identiche pagine mostrano uno sfondo Hero
lavato/grigio invece del vortice viola/fucsia reale, e i pulsanti a pagamento un bordo bianco
piatto invece dell'anello colorato) -- **da confermare sul sito vero da Gabriel**, come già
segnalato nei giri precedenti per questo stesso pulsante.

Verifica eseguita in questo giro: `tsc --noEmit`, `eslint` sui file toccati, `vitest run`
(112/112) e `next build` tutti puliti; titolo Hero verificato visivamente con la stessa tecnica
del giro precedente (sfondo di prova realistico via `page.route()` al posto del canvas, che in
questa sandbox non rende i colori veri dello shader) su desktop e mobile, prima e dopo le
correzioni -- confermato nessun alone scuro residuo e nessuna "p" tagliata in nessuno dei due
casi.

## Quarto giro di rifinitura landing, dopo l'uso reale del sito pubblicato dal terzo giro (12/09/2026)

Gabriel ha usato il sito del terzo giro e mandato 13 punti via screenshot + testo, chiudendo con
un'istruzione esplicita: fare domande a risposta multipla prima di agire sui punti ambigui.
Rispettata alla lettera -- vedi sotto quali punti sono stati chiariti prima di scrivere codice.

**Bug reali, diagnosticati e non solo ritoccati a occhio**:
- `Funzionalita.tsx`, "nella foto che vedi, manca ordine": non un giudizio estetico generico.
  Causa reale trovata rileggendo l'algoritmo: il totale di 20 unità di griglia (impostato nel
  giro precedente apposta per essere multiplo di 4 e di 2) NON è multiplo di 3 -- e la griglia
  passa proprio per 3 colonne nella fascia intermedia (`sm:grid-cols-3`, tablet/finestre strette).
  A 3 colonne un riquadro doppio lascia lì un buco che `grid-auto-flow: dense` richiude facendo
  "saltare avanti" nell'ordine visivo la prima card piccola successiva che ci sta -- l'ordine
  VISTO smette di corrispondere all'elenco. Chiarito con Gabriel prima di toccare il layout
  (`AskUserQuestion`, ha confermato questa diagnosi e scelto "riordino l'elenco"). Fix in due
  parti: (1) l'elenco è riordinato "2 riquadri normali + 1 doppio" ripetuto 5 volte invece di
  raggruppare i pilastri vicini -- un riquadro doppio cade sempre su un confine di riga pari, non
  lo attraversa mai, zero buchi/riordini a 2 e 4 colonne; (2) la fascia intermedia a 3 colonne è
  tolta del tutto (`sm:grid-cols-3` -> diretto a `lg:grid-cols-4`), l'unica larghezza in cui 20
  non torna esatto. Verificato a 375px e 1440px: ordine visivo sempre identico all'elenco.
- `Vetrina.tsx`, click su una scena "mi sposta sulla pagina a caso": bug reale, non percezione --
  l'handler usava `target.offsetTop`, che è relativo al più vicino antenato POSIZIONATO (qualsiasi
  `position` diverso da `static`), non alla cima del documento; con più antenati posizionati nella
  gerarchia (motion/GSAP ne aggiungono facilmente) il valore non corrispondeva più alla posizione
  reale nella pagina. Fix: `target.getBoundingClientRect().top + window.scrollY`, sempre assoluto
  rispetto al documento. Stessa scena, primo mobile scene card tagliato: fix con un array di
  altezze per-scena invece di un'altezza fissa uguale per tutte. Titolo sezione centrato.
- CTAFinale, "il pulsante ha un hover orrendo": bug reale, non gusto -- `MagneticButton` sposta il
  pulsante seguendo il cursore (`x`/`y` via motion values), ma `GlowBorder` sotto è un fratello
  assoluto (`inset:0`) ancorato al contenitore FISSO, non alla posizione che il pulsante assume
  mentre insegue il mouse: al hover il bordo restava fermo mentre il pulsante slittava sopra,
  sfasandosi visibilmente. Chiarito con Gabriel (`AskUserQuestion`, tre opzioni) -- scelto "fix
  mirato": tolto l'effetto magnetico da questo pulsante soltanto, `hover:scale` al suo posto,
  bagliore/bordo animato invariati.

**Decisioni chiarite con `AskUserQuestion` prima di scrivere codice** (dettaglio in
DECISIONS.md): card featured di `PerChi.tsx` spostata su "chiunque lavori su appuntamento" invece
che sui soli saloni/centri estetici; effetto `LiquidMetal` (lo shader della Hero) applicato in
forma graduata a TUTTI e tre i piani a pagamento (Starter/Growth/Pro), non solo a Growth, con
intensità crescente; conferma che la riga del promemoria di `ImpattoEconomico.tsx` era già
corretta dal giro precedente (nuovo screenshot alla mano) -- probabile cache/build non aggiornata
lato Gabriel, non un bug residuo; portata avanti l'estensione di `Reveal`/`RevealStagger` dove
mancava (opzione "a rischio più basso" scelta da Gabriel rispetto a un redesign scroll-driven più
ampio) invece di introdurre un sistema di reveal nuovo.

**Altre rifiniture**: TiltCard aggiunto alle card DIFFERENZIATORI di `PercheNoi.tsx` (mancava
rispetto a PerChi.tsx, estratto in un componente condiviso `CardDifferenziatore` per non duplicare
il markup su due griglie); scroll della navbar con easing "accelera poi rallenta" personalizzato
(`easeInOutCubic`, un listener unico a livello di documento) al posto dello smooth-scroll di
default del browser; nuovo `AuthHeader.tsx` condiviso da `/accedi` e `/registrati` (barra fissa
con logo/link alla home, sostituisce i 3 link di testo inline che c'erano prima); copy del
riquadro verde di `ImpattoEconomico.tsx` riscritto una seconda volta -- il giro precedente lo
aveva tolto dal citare il prezzo di Growth ma copriva solo i messaggi senza risposta, non gli
appuntamenti dimenticati (seconda colonna di calcolo aggiunta nel frattempo); `Reveal` esteso a
`Footer.tsx` e alla didascalia di `PrimaDopo.tsx`, le uniche porzioni di testo rimaste ferme in
uno scroll completo della pagina.

**Verifica finale**: 112/112 test passano, `eslint` pulito sui file toccati, build di produzione
pulita, zero console/page error in un controllo Playwright mirato sui punti segnalati (desktop
1440px e mobile 375px) inclusi un test funzionale del click-scroll di Vetrina (scroll di ~500px
verso la scena cliccata, non un salto a un punto casuale) e un campionamento della curva di scroll
della navbar (progressione lenta-veloce-lenta coerente con l'easing scelto). **Nota per Gabriel**:
i pulsanti `LiquidMetal` dei piani a pagamento non sono verificabili al 100% dalla sandbox --
l'ambiente Playwright qui non ha un contesto WebGL funzionante nemmeno per lo shader della Hero,
già esistente e mai toccato in questo giro (stesso problema, non una regressione introdotta ora),
quindi serve un tuo controllo visivo sul deploy reale (stesso avviso già presente per la Hero
nella sezione "Prossimo passo pianificato" sotto).

## Stack reale (verificato in `package.json`)

Next.js 16.3.4 (App Router, Turbopack) + React 19.2.8 + TypeScript + Tailwind CSS v4 +
Supabase (`@supabase/ssr` 0.12.5, `@supabase/supabase-js` 2.113.0) + Vitest per i test.
**Correzione 12/09/2026 -- questa riga era rimasta indietro**: Stripe e `@anthropic-ai/sdk`
SONO integrati nel codice da tempo (Fase 2 completata 02/09/2026, Fase 5/billing completata
11/09/2026, entrambe verificate dal vivo dove possibile -- vedi le voci dedicate sotto in
"Cosa è REALMENTE funzionante"). Lezione ripetuta la seconda volta in questo file (vedi anche
la voce "Billing/Stripe" più sotto): quando si finisce una fase, aggiornare SUBITO questa
sezione di riepilogo, non lasciarla indietro per settimane.
Progetto Supabase reale collegato: `weeaggiqovnmtovdjzxy` (region `eu-west-1`, confermata EU
l'11/09/2026 via MCP diretto).

## Cosa è REALMENTE funzionante (verificato dal vivo, non solo compilato)

- **Registrazione self-service**: `/registrati` -> `supabase.auth.signUp` -> trigger
  `al_nuovo_utente` (migrazione 0004) crea automaticamente tenant + profilo owner + 7 righe
  `orari_apertura` (tutte chiuse di default). Zero intervento manuale. Testato end-to-end nel
  browser reale più volte.
- **Login/logout**: `/accedi`, server action `esci()`.
- **Isolamento multi-tenant reale**: RLS + funzione `auth_tenant_id()` — verificato
  interrogando l'API REST di Supabase con un token utente vero: un utente legge esattamente
  1 tenant, il proprio.
- **Onboarding minimo** (`/dashboard/configura`): orari settimanali (7 giorni, apertura/
  chiusura/pausa), operatori (CRUD), servizi (CRUD, durata+prezzo), associazione
  operatore<->servizio (tabella con toggle). Tutto persistito su Supabase vero, verificato
  con reload di pagina e con una sessione browser reale (creato operatore "Sara", servizio
  "Taglio 30min 25€", associati).
- **Booking engine collegato al DB** (`src/lib/booking-engine.server.ts`): legge orari/
  chiusure/operatori/servizi/appuntamenti veri e delega SEMPRE al motore puro
  (`booking-engine.ts`, 16 test verdi) per la decisione — mai reimplementata.
- **Calendario** (`/dashboard/calendario`): lista appuntamenti del giorno, ricerca slot liberi
  per servizio/operatore/data con calcolo reale (verificato: 09:00-19:00 di apertura meno un
  servizio da 30 min produce slot fino a 18:30, passo 15 min), creazione con selezione slot a
  un click, modifica/spostamento (esclude se stesso dal controllo conflitto), cancellazione.
  **Verificato dal vivo per intero il 02/09/2026**: creato un appuntamento reale, gli slot
  occupati sono spariti dalla lista, spostato con successo, cancellato con successo, slot
  tornati liberi in ogni caso.
- **Doppia protezione anti-conflitto**: controllo applicativo (messaggio chiaro) + vincolo
  Postgres `niente_sovrapposizioni` (exclusion constraint con `btree_gist`) come rete di
  sicurezza contro le race condition — non ancora testato con un vero scenario di
  concorrenza a due richieste simultanee su questo progetto (era testato con successo sul
  progetto precedente, `test_concorrenza_prenotazione.py`; qui il test equivalente non è
  stato ancora scritto/eseguito).
- **CRM di base** (`/dashboard/clienti`, `/dashboard/clienti/[id]`): elenco clienti con ricerca
  per nome/telefono e conteggio appuntamenti, scheda cliente con dati anagrafici modificabili
  (nome/email/tag/note) e storico completo delle prenotazioni (stato, origine manuale/AI).
  Verificato dal vivo: modifica salvata e persistita dopo reload, ricerca funzionante, storico
  corretto anche per un appuntamento cancellato.
- **Dashboard con metriche reali** (punto 18): appuntamenti oggi, valore prenotato oggi,
  occupazione oggi, clienti totali/nuovi/cancellazioni, insight "clienti inattivi da 60gg" con
  azione diretta verso `/dashboard/clienti?filtro=inattivi`. Verificato dal vivo con un
  appuntamento reale da 25€/30min: tutti i numeri esatti (25,00€, 5% di occupazione su 600 min
  di apertura). Nessun numero finto: se un dato non è tracciato (es. no-show, vedi sotto) la
  card mostra onestamente 0, non un placeholder.
- **Scrittura appuntamenti unificata (single source of truth, 02/09/2026)**:
  `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant` in
  `booking-engine.server.ts` sono ora l'unico punto che scrive create/modifica/cancella —
  prendono un client Supabase come parametro, quindi la dashboard (client RLS) e i futuri tool
  AI (client admin) chiameranno esattamente lo stesso codice, mai due implementazioni separate
  (CLAUDE.md punto 9). `dashboard/calendario/azioni.ts` è ora solo parsing form + chiamata.
  Verificato dal vivo l'intero ciclo (creazione/spostamento/cancellazione) dopo il refactor.
- **Billing/Stripe (Fase 5, task #21)**: collegato per intero l'11/09/2026 sera (commit
  `faafc55`) -- `/api/stripe/checkout` (crea/riusa un Customer Stripe per tenant, Checkout
  Session in modalità subscription, trial di 10 giorni su Growth/Pro letto da
  `src/lib/stripe/piani.ts`, `tenant_id` sempre letto dalla sessione autenticata lato server,
  mai dal client), `/api/stripe/webhook` (verifica firma `stripe-signature` PRIMA di leggere il
  corpo, gestisce `checkout.session.completed` + i tre eventi `customer.subscription.*` come
  unica fonte di verità per `piano`/`stato_abbonamento` -- il client non è mai fidato per
  "ho pagato"), `/api/stripe/portal` (Customer Portal self-service: cambio piano, carta,
  cancellazione -- mantiene la promessa "Cancella quando vuoi" della CTA finale della landing).
  Collegato lato UI da `Prezzi.tsx`, `registrati/page.tsx` (redirect a Stripe dopo la
  registrazione se il piano scelto è a pagamento) e `dashboard/avvia-checkout-se-necessario.tsx`
  + `impostazioni/pulsante-portale-abbonamento.tsx`. 14 test verdi
  (`stripe/piani.test.ts`, `stripe/abbonamento.server.test.ts`), chiavi sandbox Stripe reali già
  in `.env.local` (account test "Sandbox di Via gambarelli 31"). **Non ancora verificato dal
  vivo con un pagamento di test reale nel browser** (stesso limite di sempre: il sandbox cloud
  di Claude non ha accesso di rete al progetto Supabase/Stripe reale) -- il webhook inoltre va
  ancora configurato lato Stripe Dashboard (endpoint pubblico + signing secret, impossibile
  farlo da qui prima che l'app sia deployata con un dominio reale, vedi commento nel file del
  webhook per i passi esatti).
- **AI conversazionale (Fase 2)** -- corretto 12/09/2026, questa voce era finita per errore in
  "Cosa è mock" sotto e non aggiornata da settimane: il loop AI esiste ed è verificato dal vivo,
  non solo scritto. `src/lib/ai/tools.ts` (9 strumenti: elenca_servizi, elenca_operatori,
  info_orari, verifica_disponibilita, cerca_prenotazioni_cliente, crea/modifica/cancella_
  prenotazione, trasferisci_a_operatore, tutti wrappano il booking engine reale con client
  admin) + `src/lib/ai/agente.ts` (loop tool-calling vero con `@anthropic-ai/sdk`, modello
  `claude-haiku-4-5`, max 8 iterazioni) + `api/chat/[slug]/route.ts` (endpoint pubblico reale,
  nessuna autenticazione Supabase, riconosce il visitatore da `identificatoreSessione`).
  Migrazione `conversazioni.identificatore_sessione` (0006) **applicata e confermata
  funzionante** (non più "da applicare" come scritto qui in una versione precedente di questo
  file). **Verificato dal vivo il 02/09/2026, ciclo completo**: "quali servizi offrite" ->
  risposta con prezzo reale; "vorrei prenotare un taglio domani alle 15" -> calcola la data da
  solo, verifica disponibilità, crea la prenotazione vera, confermata nel calendario dashboard;
  scenari ambigui/interrotti testati (richiesta vaga, ripensamento a metà frase, reclamo
  trasferito a un operatore umano). Difeso da gate di piano + quota mensile + anti-burst
  (`src/lib/ai/limiti.ts`, Fase 5). **Ancora aperto**: nessun canale WhatsApp/Telegram collegato
  (bloccato dalla business verification Meta, non dallo stack -- il canale attivo oggi è solo la
  chat web), e la colonna `conversazioni.slot_in_costruzione` esiste ma non è ancora usata (il
  contesto funziona comunque rileggendo lo storico messaggi ad ogni turno).
- **Sincronizzazione calendari personali, direzione import/blocco (Fase 6bis)**: entrambi i
  provider costruiti nello stesso pomeriggio. Apple/iCloud: client CalDAV puro
  (`src/lib/calendario-esterno/caldav.server.ts`, autodiscovery standard, segue il redirect di
  iCloud verso il pod giusto dell'account) + parser ICS puro con 10 test verdi (`ics.ts`, RRULE
  settimanale con BYDAY espansa davvero, EXDATE, eventi CANCELLED esclusi). Google: OAuth2 vero
  (`google.server.ts` + route `/api/calendario/google/{connect,callback}`, nonce anti-CSRF,
  refresh automatico del token) -- credenziali di Gabriel ricevute e configurate lo stesso
  giorno. UI unica in `/dashboard/impostazioni/calendari` che verifica le credenziali CalDAV per
  davvero prima di salvarle e fa collegare Google con un consenso reale, non un placeholder. Gli
  impegni importati da entrambi bloccano gli stessi slot degli appuntamenti interni sia in
  ricerca disponibilità sia in creazione/modifica (fail-open se un calendario esterno non
  risponde o un token è scaduto/revocato). **Non ancora verificato dal vivo con account reali**
  -- solo `npx vitest run` (57/57) e `npm run build` puliti finora. Migrazione
  `0008_calendari_esterni.sql` **confermata gia' applicata** sul database vero (verificato
  11/09/2026 via MCP diretto: le tabelle esistono) -- manca ancora solo Gabriel come "utente di
  test" nella schermata di consenso OAuth Google prima di poter provare quel lato dal vivo.

## Cosa è mock, incompleto o non ancora iniziato

- **Tono dell'AI personalizzabile (Fase 5, task 13/09/2026)**: CODICE SCRITTO per intero --
  3 stili guidati (professionale/amichevole/informale con emoji) + nota libera opzionale
  sanitizzata, colonna `tenants.tono_ai`/`tono_ai_nota` (migrazione `0012`, applicata al
  database reale), UI in `/dashboard/impostazioni/tono-ai`, gate di piano Pro/Enterprise
  applicato in tre punti indipendenti. 7 test nuovi, `tsc`/`eslint`/`build` puliti.
  **VERIFICATO DAL VIVO il 13/09/2026** (browser reale via l'estensione Chrome, sul salone di
  test `salone-bc163ecf` elevato temporaneamente a Pro): tono di default (professionale, senza
  emoji) confermato via chat pubblica; impostato "informale con emoji" + nota "Chiamaci sempre
  studio, mai negozio" via SQL diretto (stesso identico effetto della UI in
  `/dashboard/impostazioni/tono-ai`, non ancora testata click-per-click ma stessa server
  action) -- la chat ha risposto con emoji e ha corretto attivamente un messaggio che diceva
  "negozio" in "studio", rispettando la nota senza violare le regole assolute (nessun
  prezzo/disponibilità inventata). Tenant di test riportato a "professionale"/nota vuota subito
  dopo. Confermato anche via `git ls-remote` che il push di Gabriel del lavoro fermo da prima è
  arrivato su `origin/main` e il sito pubblico serve contenuti aggiornati.
- **Deposito/caparra anti-no-show (Fase 6, task 13/09/2026)**: CODICE SCRITTO per intero --
  migrazione `0011_deposito_caparra.sql` (colonne `tenants.caparra_*`, colonne
  `appuntamenti.caparra_*`, nuova tabella `richieste_caparra` con RLS), calcolo puro
  dell'importo (`src/lib/stripe/caparra.ts`, 6 test), impostazioni tenant
  (`/dashboard/impostazioni/caparra`, form + elenco richieste recenti incluse quelle fallite/
  rimborsate), integrazione nel flusso pubblico (`avviaPagamentoCaparra` in
  `src/app/s/[slug]/azioni.ts`, Stripe Checkout Session "payment"), gestione della conferma nel
  webhook (`completaPagamentoCaparra` in `api/stripe/webhook/route.ts`: crea l'appuntamento
  vero con la stessa `creaAppuntamentoTenant` di sempre, o rimborsa automaticamente se nel
  frattempo lo slot è stato preso da un altro cliente). `tsc`/`eslint`/`vitest` (119/119)/
  `next build` tutti puliti. **NON ancora verificato dal vivo**: (1) la migrazione non è
  applicata al database reale -- va approvata da Gabriel prima di applicarla, non è
  un'operazione che la sandbox esegue da sola su un database condiviso senza il suo ok esplicito;
  (2) nessun pagamento di test reale ancora fatto nel browser (serve dopo la migrazione); (3) il
  webhook Stripe esistente già gestisce il nuovo evento senza bisogno di una nuova
  configurazione lato Stripe Dashboard (stesso endpoint, stesso signing secret). Vedi "Problemi
  noti aperti" per il limite di design onestamente segnalato (slot non bloccato durante il
  pagamento).
- **Lista d'attesa automatica alla cancellazione (Fase 6, task 13/09/2026)**: CODICE SCRITTO
  per intero -- tabella `lista_attesa` (migrazione `0013_lista_attesa.sql`:
  tenant/servizio/operatore opzionale/cliente/data preferita opzionale/stato), match FIFO
  dentro `cancellaAppuntamentoTenant` (`trovaEAvvisaListaAttesa` in booking-engine.server.ts,
  fail-open su qualunque errore -- non blocca mai la cancellazione vera), due punti di
  ingresso (form manuale in `/dashboard/lista-attesa` + nuovo strumento AI
  `aggiungi_lista_attesa` quando `verifica_disponibilita` non trova nulla), banner immediato in
  `/dashboard/calendario` dopo una cancellazione con match. **Notifica al cliente NON
  automatica** (nessun provider email/SMS nel progetto oggi, vedi "Gruppo B-bis" punto 1 in
  PIANO.md): il titolare vede la riga "proposto" e contatta a mano -- limite onestamente
  segnalato, non un difetto nascosto. 11 test nuovi, `tsc`/`eslint`/`vitest`
  (136/136)/`build` puliti. Migrazione `0013_lista_attesa.sql` **applicata al database reale il
  13/09/2026** (stesso via libera già dato per `0011`/`0012`, nessun nuovo problema dai
  controlli di sicurezza Supabase). **NON ancora verificato dal vivo**: nessuna cancellazione
  reale con un match ancora provata in un browser vero (serve almeno un cliente in lista +
  un appuntamento dello stesso servizio da cancellare).
- **WhatsApp**: predisposizione tecnica per l'Embedded Signup Meta scritta
  (`src/lib/whatsapp-embedded-signup.ts`, `src/app/api/whatsapp/embedded-signup/callback/
  route.ts`, migrazione 0003) ma **non attivabile**: bloccata dalla business verification
  Meta + P.IVA di Gabriel, in pausa per sua scelta. Il canale AI di default pianificato è
  invece la chat web (nessuna approvazione esterna richiesta) — non ancora costruito.
- **Analytics avanzate**: retention/no-show/canale di acquisizione -- non ancora iniziate (il
  no-show in particolare non ha ancora nessun flusso che lo marchi davvero, vedi sotto).
- **Pagina pubblica per-attività (Fase 4, punto 15)**: CODICE SCRITTO 11/09/2026 -- route
  `/s/[slug]` (Server Component, `src/lib/pagina-pubblica.server.ts` per il loader), flusso di
  prenotazione cliente self-service (`FlussoPrenotazione.tsx`: servizio -> data -> slot ->
  contatto -> conferma, server action in `azioni.ts` che riusa `creaAppuntamentoTenant` con
  `creatoDa: "pubblico"`) e widget chat AI flottante (`ChatWidgetPubblico.tsx`, mostrato solo se
  il piano include la chat AI web). Verificato: suite di test (98/98, incluso il loader con
  mutation test), `tsc --noEmit`, `eslint`, `next build` tutti puliti. **NON ancora verificato
  dal vivo in un browser reale con un salone di test**: il sandbox cloud dove gira Claude non ha
  accesso di rete al progetto Supabase reale (stesso limite già noto per altri strumenti), quindi
  la verifica end-to-end (aprire `/s/<slug>` di un salone vero, cercare slot, prenotare, parlare
  con la chat) va fatta da Gabriel dopo il deploy -- vedi "Problemi noti aperti" #15 per un altro
  limite onestamente segnalato (nessun anti-abuso oltre al tetto mensile Free).
- **Sincronizzazione calendari, direzione export (Fase 6bis)**: mostrare gli appuntamenti del
  salone sul calendario personale dell'operatore non è ancora scritto per nessuno dei due
  provider -- la tabella `eventi_calendario_esterni` esiste già in previsione di questo (vedi
  sopra per la direzione import/blocco, quella già costruita).
- **Foto/galleria**: zero codice. Colonne `logo_url`/`cover_url` esistono sullo schema
  `tenants` ma senza upload né Supabase Storage configurato.
- **Automazioni**: tabella `automazioni` esiste nello schema, nessun motore che la legga o
  scriva.
- **Analytics**: zero codice oltre ai dati grezzi già in tabella (appuntamenti/clienti).
- ~~Billing/Stripe: zero integrazione~~ **NON PIÙ VERO -- il codice esiste già, questo file
  era rimasto indietro**: trovato durante il controllo di accuratezza della documentazione del
  12/09/2026 che l'ultimo commit del repo (`faafc55`, 11/09/2026 23:59, mai riflesso qui) ha
  già collegato Stripe per intero -- vedi la voce spostata sopra in "Cosa è REALMENTE
  funzionante" per il dettaglio. Lezione: quando si finisce una sessione tardi, aggiornare
  SUBITO questo file prima di chiudere, non rimandare al giorno dopo.
- **Admin panel per Gabriel**: zero codice.
- **PWA**: zero manifest/service worker. L'app è oggi un sito responsive Tailwind, non
  un'esperienza installabile.
- **Copy generico per il target ampio**: deciso il 02/09/2026 di allargare il target oltre
  "centri estetici", ma `/registrati` e la dashboard usano ancora testi salone-specifici
  ("Crea il tuo salone") — task aperto, non urgente finché non si tocca quel copy.

## Problemi noti aperti

1. ~~Fuso orario semplificato come UTC in tutto il booking engine~~ **CODICE FATTO
   11/09/2026**: aggiunta colonna `tenants.fuso_orario` (migrazione 0010, default
   `'Europe/Rome'`, già applicata al database reale), nuovo modulo `src/lib/fuso-orario.ts`
   (`realeAPseudoUtc`/`pseudoUtcAReale`, con test) e conversione applicata ai DUE confini
   dove serve un istante reale: la colonna `timestamptz` di `appuntamenti` (scrittura in
   `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`, lettura in
   `caricaContestoBooking`/`verificaConflittoTenant`) e le API Google/CalDAV
   (`collegamenti.server.ts`). Il motore puro (`booking-engine.ts`), `parsaOrarioLocale`
   e la UI della dashboard restano invariati: continuano a ragionare nella stessa
   convenzione "pseudo-UTC" di sempre. Trovato dal vivo l'11/09/2026 durante la verifica
   del sync Google Calendar (un test iniziale sembrava indicare un sync rotto: era invece
   proprio questo bug, con gli appuntamenti sfasati dell'offset del fuso). Test e build
   passano.
2. ~~Repo Git canonico nel sandbox cloud effimero, nessun remote GitHub permanente~~
   **RISOLTO 11/09/2026**: repo spostata su `github.com/gab3code/salone-ai-saas` (privata),
   progetto Vercel collegato via GitHub App (deploy automatico ad ogni push su `main`). Vedi
   DECISIONS.md per il dettaglio (incluso l'ostacolo di rete aggirato per il push iniziale).
   Primo deploy di test live: https://salone-ai-saas.vercel.app (variabili d'ambiente Supabase/
   Anthropic configurate su Vercel; Google Calendar/Stripe/WhatsApp non ancora, non servono per
   questo test).
3. **Causa più probabile degli errori intermittenti in `node_modules` sotto Turbopack** (`EOF
   while parsing`, `Resource deadlock avoided`), rivista il 02/09/2026: inizialmente attribuiti
   a iCloud Drive che sincronizza la cartella Desktop; scoperta oggi una causa alternativa più
   concreta -- i tool del bridge (`device_bash`) eseguono in una VM Linux separata che monta la
   STESSA cartella del progetto sul Mac. Un `npm install` lanciato da lì scriverebbe binari
   nativi Linux (es. SWC) nello stesso `node_modules` che poi il Terminal reale del Mac
   (macOS/arm64) prova a usare -- gli stessi sintomi di "file JSON corrotto"/"deadlock" che si
   sono visti. **Non ancora confermato con certezza, ma per sicurezza: `npm install` va sempre
   lanciato nel Terminal reale del Mac di Gabriel, mai tramite i tool del bridge**, finché non
   si verifica altrimenti. iCloud resta una causa concorrente plausibile, non esclusa.

   **Aggiornamento 12/09/2026 -- stesso sintomo confermato anche su git, non solo npm**: il repo
   locale `~/Desktop/salone-ai-saas` (fuori da "Claude Project", trovato solo dopo che Gabriel ha
   corretto la cartella) ha `.git/index.lock` attivo + `HEAD.lock.stale`/`index.lock.stale`
   risalenti al 02/09 11:31-11:50 (mai puliti da un'operazione git interrotta), e leggere
   `.git/refs/heads/master` da `device_bash` restituisce **"Resource deadlock avoided"** --
   stesso errore di sistema del punto sopra, stavolta su un file di git invece che su
   `node_modules`. Rafforza l'ipotesi del bridge (o iCloud, o entrambi in combinazione) come
   causa reale, e la estende: **anche i comandi git vanno lanciati SOLO dal Terminal reale del
   Mac, mai da `device_bash`** -- usarlo per ispezionare un repo (anche solo `git status`/`log`)
   rischia di aggiungere altro lock contention su una cartella già fragile. Il repo resta
   probabilmente recuperabile (branch `master`, nessun `remote "origin"` configurato in
   `.git/config` -- non ha mai ricevuto un push diretto), ma **non ripararlo da qui**: il modo
   più sicuro è che Gabriel cloni fresco l'ultimo bundle in una cartella FUORI da iCloud (es.
   `~/dev/`, non `~/Desktop/`), imposti lì il remote (`git@github.com:gab3code/salone-ai-saas.git`
   o la versione HTTPS) e pushi da lì, lasciando perdere la copia corrotta.
4. **Connettore Vercel non interrogabile da questa sessione (12/09/2026)**: risulta "connected"
   e abilitato in chat, ma `mcp__Vercel__list_teams` restituisce sempre una lista vuota (anche
   dopo un refresh del connettore) e le altre chiamate (progetti, deployment) fanno tutte da
   `teamId`, quindi falliscono senza un team da passare. Il progetto e il deploy live esistono
   di sicuro (vedi punto 2 sopra, https://salone-ai-saas.vercel.app), quindi non è un problema
   del progetto Vercel in sé -- sembra un'autorizzazione OAuth di questa sessione specifica
   rotta o scaduta. Non risolto: se serve di nuovo operare su Vercel da qui, riprovare prima a
   riconnettere il connettore dalle impostazioni di Claude.
4. ~~Nessun test automatico per `booking-engine.server.ts`~~ **RISOLTO 11/09/2026**: 29 test
   nuovi in `booking-engine.server.test.ts`, con un client Supabase finto
   (`src/test/supabase-finto.ts`, riutilizzabile per testare altri file `*.server.ts` in
   futuro -- code FIFO per tabella/operazione, cattura i payload scritti per verificarli).
   Copertura: `parsaOrarioLocale` (formati validi/invalidi, prima non testato affatto),
   `caricaContestoBooking` (mapping + fusione impegni esterni + propagazione errori),
   `verificaConflittoTenant` (conflitto sì/no, esclusione dell'appuntamento in modifica,
   impegni esterni), `creaAppuntamentoTenant`/`modificaAppuntamentoTenant` (tetto mensile
   Free, servizio non trovato, conflitto bloccante, **conversione fuso orario corretta
   scritta su Postgres** -- verificato anche "in negativo": reintrodotto di proposito il
   vecchio bug del fuso e confermato che i test lo beccano, poi ripristinato il codice
   corretto -- cliente trovato/creato, mapping dell'errore Postgres `23P01`),
   `cancellaAppuntamentoTenant`. Suite totale ora 93/93 verde, build pulita.
5. **Concorrenza non testata su questo progetto**: il vincolo DB esiste ma non è stato
   ancora verificato con un vero test a due richieste simultanee (era stato fatto con
   successo sul progetto precedente con un meccanismo diverso).
6. ~~Region Supabase EU non ancora confermata~~ **RISOLTO 11/09/2026**: confermato via MCP
   diretto al progetto (`weeaggiqovnmtovdjzxy`) — region `eu-west-1`. Possiamo dichiarare "dati
   in Europa" come Estetia.
7. **Migrazione 0006 (`identificatore_sessione` su `conversazioni`)**: applicata da Gabriel
   direttamente nell'SQL Editor di Supabase il 02/09/2026 (non verificata da questa sessione con
   una query -- nessun modo autonomo di leggere lo schema senza toccare credenziali che non
   sono mie da usare, vedi DECISIONS.md). La conferma reale arriverà collegando il motore di
   conversazione (Fase 2) che la userà per davvero.
8. **No-show non ancora tracciato**: nessun flusso della dashboard marca oggi un appuntamento
   come `no_show` (solo `confermato`/`cancellato` esistono nei dati reali) -- la metrica esiste
   già in `metriche.ts` mostra onestamente 0 finché non c'è un'azione "cliente non si è
   presentato" da qualche parte nella UI. Da aggiungere insieme al resto del CRM/calendario.
9. ~~`ANTHROPIC_API_KEY` in `.env.local` solo nel sandbox cloud~~ **RISOLTO 02/09/2026**:
   Gabriel l'ha aggiunta a mano nel suo `.env.local` locale (il bridge blocca di proposito la
   scrittura di quel file) e l'ha verificata con `grep` -- confermata presente.
10. ~~`service_role` senza GRANT di base su nessuna tabella `public`~~ **RISOLTO 02/09/2026**:
    scoperto dal vivo durante il primo vero test della chat AI (Task #66) -- `risolviTenantIdDaSlug`
    falliva con `permission denied for table tenants` (Postgres 42501), non con "0 righe".
    L'assunzione scritta nel commento originale di 0005 ("service_role ha già pieno accesso di
    default") era sbagliata: bypassa le POLICY di RLS ma non i GRANT di tabella, due controlli
    indipendenti. Fix in `0007_grant_service_role.sql`, eseguita da Gabriel nell'SQL Editor --
    confermato dal vivo che risolve.
11a. ~~Manca il GRANT per `authenticated` su `collegamenti_calendario_esterni`/
    `eventi_calendario_esterni`~~ **RISOLTO 11/09/2026** (migrazione 0009): stesso identico bug
    del problema #10 (RLS corretta ma GRANT di tabella mancante), stavolta per il ruolo
    `authenticated` invece di `service_role` -- scoperto dal vivo con un 500 reale su
    `/dashboard/impostazioni/calendari` non appena un utente vero ha provato la pagina sul
    deploy Vercel. La migrazione 0008 aveva concesso i permessi solo a `service_role`.
12. **Il modello non conosceva la data odierna**: senza contesto esplicito, `costruisciSystemPrompt`
    non passava la data reale, quindi il modello chiedeva al cliente di calcolare "domani" da
    solo (pessima UX, e un rischio di dato sbagliato se il cliente sbagliava il calcolo). Fix:
    la data/ora reale (`adesso: Date`, iniettabile nei test) è ora nel system prompt --
    verificato dal vivo che il modello calcola correttamente "domani" senza chiederlo.
12. **`eseguiStrumento` non manteneva davvero la sua promessa di non lasciar scappare eccezioni**:
    scoperto dal vivo -- il modello ha passato il NOME di un servizio ("taglio") invece del suo
    uuid a `verifica_disponibilita`, e `caricaServizi` in `booking-engine.server.ts` lancia
    un'eccezione su un id in formato non valido (contratto corretto per la dashboard, dove un
    umano vede una pagina d'errore) che però rompeva l'intera richiesta HTTP della chat con un
    500 invece di lasciare che l'AI si correggesse nello stesso turno. Fix su più livelli: (a)
    `eseguiStrumento` ora avvolge davvero ogni chiamata in un try/catch, (b) validazione esplicita
    del formato uuid per ogni id in input PRIMA di interrogare il database, con un messaggio che
    dice esplicitamente all'AI di usare l'id restituito da elenca_servizi/elenca_operatori, non il
    nome, (c) la regola 1 del system prompt lo dice esplicitamente. Test di regressione aggiunti
    in `tools.test.ts`.
13. ~~Struttura piani decisa ma parzialmente applicata~~ **RISOLTO 02/09/2026**: sia la chat AI
    (`src/lib/ai/limiti.ts`, gate + quota mensile + anti-burst, collegati in
    `api/chat/[slug]/route.ts`) sia il tetto di 60 prenotazioni/mese sul piano Free
    (`src/lib/piani.ts`, controllo dentro `creaAppuntamentoTenant` -- vale sia da dashboard che
    da AI, stessa funzione) ora sono applicati tecnicamente, non solo decisi. Verificato con
    `npx vitest run` (47/47) e `npm run build` puliti; il tetto prenotazioni non è ancora stato
    verificato dal vivo nel browser con un vero tenant Free (nessun modo pratico di creare 60
    prenotazioni reali per il test) -- rischio residuo basso, la stessa query count/head è già
    usata e verificata altrove nel progetto. Nota operativa: il tenant di test di Gabriel
    ("Salone Test Fase1", slug `salone-ad2fec99`) è stato alzato a `piano = 'growth'` per poter
    continuare a testare la chat AI dal vivo.
14. **Apple/iCloud CalDAV probabilmente inutilizzabile da hosting cloud standard (Vercel)**:
    scoperto dal vivo l'11/09/2026 con Gabriel dopo tre giri di fix reali e verificati sul
    client CalDAV (User-Agent mancante, `Authorization` perso su un presunto redirect,
    un'eccezione non gestita che lasciava una richiesta appesa -- tutti e tre bug veri,
    confermati leggendo il codice, non ipotesi) -- la stessa identica richiesta PROPFIND con
    le stesse credenziali (password app-specifica reale, verificata funzionante) torna
    `207 Multi-Status` da `curl` lanciato dal Mac di Gabriel e `400` senza corpo/header utili
    quando parte da una funzione serverless su Vercel. Diagnosi: non è più un problema di
    codice (le credenziali sono confermate corrette, il client CalDAV è confermato corretto
    via test comparativo diretto), ma un blocco lato Apple sul traffico CalDAV che origina da
    IP di data center/cloud (pattern noto e documentato altrove per iCloud). **Non risolvibile
    lato nostro senza instradare le chiamate attraverso un IP non-datacenter** (proxy
    residenziale a pagamento, comunque non garantito nel tempo). Raccomandazione: non investire
    altro tempo a rincorrere il client CalDAV Apple da Vercel; trattare Google Calendar (OAuth,
    non CalDAV grezzo, nessun blocco di questo tipo riscontrato) come l'unico canale di
    sincronizzazione calendario personale realmente affidabile per ora, e documentare Apple
    come "supportato solo se il salone gestisce la connessione da un ambiente non-cloud" o
    non supportato, a seconda di cosa deciderà Gabriel.

15. **Prenotazione pubblica (`/s/[slug]`) senza anti-abuso dedicato**: a differenza di
    `/api/chat/[slug]` (anti-burst + quota mensile, perché ogni messaggio ha un costo Anthropic
    reale), le server action pubbliche di prenotazione (`src/app/s/[slug]/azioni.ts`) non hanno
    nessuna difesa specifica oltre al tetto mensile già esistente del piano Free -- una
    prenotazione costa quasi zero da salvare, ma uno script potrebbe comunque riempire il
    calendario di un salone con prenotazioni finte (righe `clienti`/`appuntamenti` spazzatura).
    Accettabile per ora (nessun salone reale ancora pubblico), ma da rivedere prima che un
    salone vero pubblichi il link -- possibili opzioni: conferma via SMS/WhatsApp del numero
    prima di bloccare lo slot, un semplice rate-limit per IP, o un CAPTCHA invisibile.

16. **Deposito/caparra: lo slot non è bloccato durante il pagamento (13/09/2026)**: per non
    creare un appuntamento "fantasma" prima di sapere se il cliente paga davvero, l'appuntamento
    nasce solo al webhook `checkout.session.completed`. Conseguenza onestamente segnalata: due
    clienti potrebbero avviare il pagamento per lo stesso slot quasi in contemporanea -- chi
    completa il pagamento per secondo trova il conflitto quando il webhook prova a creare
    l'appuntamento, e viene **rimborsato automaticamente** (`stripe.refunds.create`), con la riga
    in `richieste_caparra` marcata `fallita_conflitto` (visibile in
    `/dashboard/impostazioni/caparra`) invece di sparire nel nulla. Resta comunque un'esperienza
    peggiore che bloccare davvero lo slot durante il pagamento (soluzione più complessa, non
    fatta ora: richiederebbe una "prenotazione provvisoria" con scadenza automatica, un nuovo
    stato appuntamento e un job di pulizia). Accettabile al primo rilascio -- nessun salone reale
    ha ancora il traffico perché due persone scelgano lo stesso slot nella stessa finestra di
    pochi minuti -- da rivedere se diventa un problema reale.

## Mappa dei file principali

- `src/lib/booking-engine.ts` — motore di disponibilità puro (nessuna query DB), 16 test.
- `src/lib/booking-engine.server.ts` — collegamento a Supabase, delega sempre al motore puro;
  espone anche `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant`
  (scrittura, client-agnostiche) e `parsaOrarioLocale` (validazione rigida di un orario in
  arrivo da fuori, usata sia dalla dashboard sia dagli strumenti AI).
- `src/lib/ai/tools.ts` — strumenti dell'AI receptionist (Fase 2), wrappano il booking engine
  con un client admin/service_role; 9 test di validazione in `tools.test.ts`.
- `src/app/dashboard/clienti/` — elenco clienti con ricerca + scheda cliente (dati anagrafici
  modificabili, storico prenotazioni completo).
- `src/lib/metriche.ts` / `metriche.server.ts` — metriche dashboard (logica pura + collegamento
  Supabase, stesso pattern del booking engine).
- `src/lib/supabase/{client,server,admin,tenant}.ts` — client browser/server/service-role e
  helper "utente loggato -> tenant_id".
- `src/app/registrati`, `src/app/accedi` — funnel di ingresso self-service.
- `src/app/dashboard/{page,azioni}.tsx` — dashboard minima + logout.
- `src/app/dashboard/configura/` — onboarding orari/operatori/servizi.
- `src/app/dashboard/calendario/` — vista calendario, creazione/modifica/cancellazione.
- `src/lib/calendario-esterno/{ics,caldav.server,google.server,collegamenti.server}.ts` —
  sincronizzazione calendari personali (Fase 6bis): parser ICS puro e testato, client CalDAV,
  client OAuth2/Calendar API Google, collegamento al motore di disponibilità.
- `src/app/api/calendario/google/{connect,callback}/route.ts` — flusso OAuth2 Google Calendar.
- `src/app/dashboard/impostazioni/calendari/` — UI collega/scollega calendario Apple/Google per
  operatore.
- `src/proxy.ts` — refresh sessione Supabase (era `middleware.ts`, rinominato per Next 16).
- `supabase/migrations/0001-0008` — schema multi-tenant, chiusure, prep WhatsApp,
  provisioning automatico, fix GRANT (x2), sessione conversazioni, calendari esterni.
- `docs/analisi-estetia.md` — analisi competitiva (screenshot + giro dal vivo sul sito).
- `docs/verifica-stack-automazione.md`, `docs/verifica-fattibilita-33-punti.md` — verifica
  che lo stack supporti il funnel self-service richiesto.
- `docs/embedded-signup-whatsapp.md` — guida tecnica Embedded Signup Meta.
- `docs/librerie-ui.md` — quali connettori/librerie UI usare (21st, OriginKit, Framer Motion,
  GSAP) per superfici rivolte all'esterno (landing, pagina pubblica) -- leggere PRIMA di
  costruire una nuova sezione visuale, non riscoprire da zero ogni volta.
- `src/lib/pagina-pubblica.server.ts` — loader del profilo pubblico di un salone (tenant +
  servizi/operatori attivi) per slug, client admin, solo colonne pensate per essere pubbliche.
- `src/app/s/[slug]/` — pagina pubblica del salone (Fase 4): `page.tsx` (Server Component),
  `azioni.ts` (server action pubbliche `cercaSlotPubblici`/`prenotaPubblico`),
  `FlussoPrenotazione.tsx` (stepper client di prenotazione), `ChatWidgetPubblico.tsx` (widget
  chat AI flottante, riusa l'endpoint `/api/chat/[slug]` già esistente).
- `src/app/page.tsx` + `src/components/landing/` — landing page di marketing: `Nav`, `Hero`
  (+ `AnteprimaProdotto`, parola che ruota, sfondo a fasci di luce), `ProdottoScroll` (dashboard
  vero stile "MacBook scroll"), `ComeFunziona`, `PrimaDopo` (confronto trascinabile), `Vetrina`
  (showcase scroll-driven GSAP solo desktop via `gsap.matchMedia()`, 6 scene reveal-only su
  mobile -- vedi sessione 12/09/2026 sopra), `ImpattoEconomico` (calcolo economico a due colonne
  con numero animato, due catene di ipotesi -- messaggi senza risposta e appuntamenti
  dimenticati, aggiornato nel secondo giro del 12/09/2026), `PercheNoi` (differenziatori reali
  senza nominare concorrenti + timeline verticale del flusso, riscritta nel secondo giro),
  `Funzionalita` (bento grid asimmetrica, tutte le funzioni allo stesso livello -- niente più
  badge "in arrivo", riscritta nel secondo giro), `PerChi` (bento grid, 6 categorie incluso un
  "chiunque altro lavori su appuntamento", riscritta nel secondo giro), `Prezzi`, `Faq` (7
  domande pre-footer), `CTAFinale` (sfondo a particelle), `Footer`, più i primitivi riusabili
  `Reveal.tsx`, `MagneticButton.tsx`, `Grana.tsx`, `RaggiSfondo.tsx`, `SpotlightCard.tsx`,
  `TiltCard.tsx`, `CompareSlider.tsx` (bordo animato + maniglia con icona drag, dal secondo giro),
  `FlipWords.tsx`, `Lampada.tsx`, `VorticeSfondo.tsx`, `BorderBeam.tsx`, `GlowBorder.tsx`
  (dettagli di ognuno in `docs/librerie-ui.md`).
- `src/app/not-found.tsx` — 404 brandizzata (nuovo 12/09/2026).

## Prossimo passo pianificato

**Landing page (`/`, `/registrati`, `/accedi`): il ciclo "Claude rifinisce -> Gabriel prova dal
vivo -> nuove correzioni puntuali" può considerarsi concluso con questo terzo giro** -- tre
round di correzioni via screenshot reali, l'ultimo dei quali (questo) ha risolto gli ultimi bug
di layout genuini (bento grid, allineamento testo, timing di un'animazione) invece di preferenze
di stile ancora aperte. Resta comunque raccomandato un ultimo giro di Gabriel sul deploy reale
(non lo stesso della sandbox) prima di condividere il link pubblicamente, perché alcuni effetti
dipendono da hardware/browser reale e non sono mai stati (e non possono essere, dal sandbox)
verificati lì: il glow del mouse sull'Hero (`LiquidMetal`), la showcase scroll-driven desktop di
`Vetrina.tsx` (pin+scrub GSAP), i bottoni magnetici. Se quel giro non trova altro, la landing è
pronta per il traffico reale.

**Il vero prossimo passo del progetto, dopo la landing, è verificare dal vivo (fuori sandbox,
serve Gabriel) tutto ciò che è già scritto e testato ma mai provato in un browser reale contro
Supabase/Stripe/Google veri** -- in ordine di blocco:
1. **Deploy su Vercel** (già collegato, deploy automatico ad ogni push su `main` -- vedi
   "Problemi noti aperti" #2) del codice di questo giro, appena committato e consegnato.
2. **Fase 4, pagina pubblica per-salone (`/s/[slug]`)**: codice scritto e testato l'11/09/2026,
   **mai aperta in un browser reale** -- provare l'intero flusso (cercare slot, prenotare,
   parlare con il widget chat AI) su un salone di test vero.
3. **Checkout Stripe (Fase 5, task #21)**: codice collegato per intero l'11/09/2026 sera, **mai
   verificato con un pagamento di test reale** -- serve anche configurare il webhook lato Stripe
   Dashboard (endpoint pubblico + signing secret), possibile solo ora che l'app ha un dominio
   pubblico. Include verificare dal vivo che il trial resti solo su Growth dopo il cambio di
   questo giro (checkout su Pro senza alcun periodo di prova).
4. **Anti-abuso della prenotazione pubblica** (problema noto #15): da valutare prima di
   pubblicare il link di un salone vero, non prima -- nessun salone reale è ancora pubblico.
5. Dopo questi 4 punti, i pezzi rimasti prima di un lancio commerciale vero sono quelli già
   elencati in "Cosa è mock, incompleto o non ancora iniziato": WhatsApp (bloccato su business
   verification Meta, non su di noi), pannello admin per Gabriel, PWA, analytics avanzate,
   sincronizzazione calendari in direzione export -- nessuno di questi blocca l'apertura dei
   pagamenti reali (il commitment di DECISIONS.md, voce "Il sito descrive il prodotto al
   lancio", è costruirli PRIMA di aprire i pagamenti veri, non prima del deploy).

Cleanup manuale non urgente da fare quando Gabriel ha un minuto sul Mac: rimuovere
`src/components/primitives/` e `src/app/beautifui/` (codice morto, mai collegato a nessuna
route, non cancellabile da questa sessione per il blocco del classificatore su operazioni
distruttive).
