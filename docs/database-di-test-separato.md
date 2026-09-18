# Il database dei test, separato da quello vero

Fino al 18/09/2026 la suite E2E creava tenant, clienti e appuntamenti **veri**
nel database di **produzione**, e faceva partire webhook Stripe veri. Con zero
clienti era solo sporcizia. Dal primo cliente pagante sarebbe un incidente che
aspetta di succedere, e il momento giusto per separarli e' adesso, finche' non
c'e' niente da perdere.

Il codice e' pronto. Restano due passi che devi fare tu, perche' richiedono il
pannello Supabase e delle chiavi.

---

## Cosa cambia da subito, anche prima di fare i due passi

`npx playwright test` **non parte piu'** se non gli dici su quale database
girare. Non e' un avviso, e' un blocco: un avviso si ignora, e questo e' il
genere di errore che non si vuole scoprire dopo.

Se ti serve un giro al volo sul database vero, sapendo cosa stai facendo:

```bash
E2E_CONSENTI_PRODUZIONE=1 npx playwright test
```

Da riga di comando e non dentro un file, cosi' resta una decisione presa ogni
volta invece di una che si dimentica accesa. Quando lo usi, la suite stampa un
avviso in cima.

---

## Passo 1: il progetto di prova

Hai gia' due progetti Supabase, e il secondo slot del piano gratuito e'
occupato da **"Gabriel's Project"** del 19 agosto, in pausa. Due strade:

- **Se quel progetto non ti serve piu'**: riusalo. Pannello Supabase, aprilo,
  "Restore project" per risvegliarlo, e poi svuotalo prima di applicarci le
  migrazioni.
- **Se invece contiene qualcosa**: cancellalo solo se sei sicuro, oppure valuta
  che il piano gratuito ti lascia due progetti attivi e il terzo si paga.

Non lo tocco io: e' roba tua e non so cosa ci sia dentro.

## FATTO il 18/09/2026, e cosa e' venuto fuori

Il progetto di prova (`obwrmginufuummxhtimr`) e' stato svuotato e ricostruito
applicando tutte le migrazioni. Poi i due schemi sono stati confrontati:
tabelle, colonne, tipi, policy, permessi di tabella e permessi di colonna.

**Schema, policy: identici al primo colpo.** 28 tabelle, 55 policy, stesse
impronte. I file di migrazione ricostruiscono la STRUTTURA di produzione senza
buchi.

**I permessi no, ed era grave.** Nel database ricostruito dai soli file, il
ruolo `anon` -- la chiave pubblica, quella che sta nel browser di chiunque --
aveva INSERT, UPDATE e DELETE su tutte e 28 le tabelle, comprese
`whatsapp_credenziali` (i token dei saloni), `membri_tenant` (chi e' owner) e
`interventi_admin` (il registro). In produzione non ne ha nessuno.

Quelle revoche erano state fatte a mano in produzione e non stavano in nessun
file. Ricostruendo il database da questo repo -- dopo un disastro, o per un
ambiente nuovo -- sarebbe nato spalancato, e con le policy RLS come unica
linea di difesa invece della seconda. La migrazione **0049** le mette nel
repo, e sistema anche le default privileges, cioe' il motivo per cui il
problema sarebbe tornato alla prossima tabella creata.

Un dettaglio istruttivo: la prima versione della 0049 era sbagliata. Un
REVOKE sulla TABELLA porta via anche i grant di COLONNA, quindi annullava la
0030 e il titolare non poteva piu' cambiare nemmeno il nome del proprio
salone. L'ha trovato il confronto degli schemi fatto subito dopo averla
applicata. Senza quel confronto sarebbe finita in produzione.

**Stato finale**: le quattro impronte (schema, policy, permessi di tabella,
permessi di colonna) combaciano fra i due progetti.

**Resta da fare in produzione**: applicare la 0049 anche li'. I permessi sono
gia' corretti, ma le *default privileges* no: la prossima migrazione che
aggiunge una tabella la farebbe rinascere scrivibile da `anon`.

---

## Passo 2 (storico): le migrazioni sul progetto di prova

Qui c'e' una cosa che **nessuno ha mai verificato**: non sappiamo se i 48 file
in `supabase/migrations/` ricostruiscono davvero lo schema di produzione. Quel
database e' stato costruito in parte a mano, e almeno cinque migrazioni (0022,
0023, 0024, 0025, 0030) sono state applicate dall'editor SQL senza finire nel
registro.

Se i file non bastassero, il database di prova sarebbe **diverso** da
produzione e i test mentirebbero nel modo peggiore: passando.

Quindi il passo 2 non e' solo "applica le migrazioni", e' anche la prova che
siano complete. Quando mi dai il riferimento del progetto di prova le applico
io in ordine e confronto i due schemi colonna per colonna: tabelle, colonne,
vincoli, funzioni e permessi. Quello che manca diventa una migrazione nuova,
che sistema anche il repo.

## Passo 3: le chiavi

Nel progetto di prova, Settings -> API, e crea `.env.test` nella cartella del
progetto (e' gia' ignorato da git):

```
E2E_SUPABASE_URL=https://<progetto-di-prova>.supabase.co
E2E_SUPABASE_ANON_KEY=...
E2E_SUPABASE_SERVICE_ROLE_KEY=...
```

Tutte e tre, o nessuna: una configurazione a meta' viene rifiutata, perche'
indovinare quale pezzo valga significa rischiare di scrivere in produzione.

---

## Cosa NON cambia

- **Anthropic**: gli otto scenari con l'AI vera continuano a costare. Il
  database separato non c'entra con quello.
- **Stripe**: resta in modalita' test come adesso. I test non chiamano il
  webhook vero, lo simulano.
- **Mailjet**: in locale non e' configurato, quindi nessuna email parte. E'
  voluto.

## Un dettaglio che vale la pena conoscere

Quando i test girano sul database di prova, Playwright **non riusa** un
`npm run dev` gia' acceso: quel server e' partito da `.env.local` e
scriverebbe in produzione mentre i test guardano altrove. Se la porta 3000 e'
occupata, la suite fallisce invece di partire -- ed e' il comportamento
giusto: meglio un errore chiaro che scrivere nel posto sbagliato senza
accorgersene.

Con `E2E_CONSENTI_PRODUZIONE=1` il riuso torna attivo, perche' li' il database
e' lo stesso di sempre.
