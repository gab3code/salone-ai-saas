# Da lanciare in console, 18/09/2026 sera

Preparato mentre eri fuori. **In ordine**: i passi 1-3 vanno fatti nell'ordine
scritto, il resto e' verifica.

---

## 1. Il push

```
git push
```

Tredici commit. Poi aspetta che Vercel finisca il deploy (~1 minuto): il passo 2
dipende da quello.

---

## 2. L'unica migrazione che va applicata DOPO il deploy

La **0065** toglie ad `authenticated` i permessi su
`collegamenti_calendario_esterni`. Il codice online **prima** del deploy legge
ancora quella tabella con il client dell'utente: applicarla adesso ti
romperebbe la pagina calendari. Dopo il deploy nessuno la legge piu' da li'.

**FATTA il 18/09/2026 sera** -- Gabriel l'ha lanciata dall'editor SQL dopo che
il deploy di `88f5a14` era `READY`. Verificata subito dopo: `authenticated` e
`anon` non hanno piu' SELECT/INSERT/UPDATE/DELETE su nessuna delle due tabelle,
`service_role` le ha ancora tutte. Resta qui per memoria di cosa e' stato
lanciato.

Dall'editor SQL di Supabase, sul progetto di **produzione**
(`weeaggiqovnmtovdjzxy`):

```sql
revoke select, insert, update, delete on public.collegamenti_calendario_esterni from authenticated;
revoke select, insert, update, delete on public.collegamenti_calendario_esterni from anon;
revoke select, insert, update, delete on public.eventi_calendario_esterni from authenticated;
revoke select, insert, update, delete on public.eventi_calendario_esterni from anon;
```

Le altre due migrazioni di stasera (**0066** e **0067**) sono **gia' applicate
a produzione e al database di prova**: la 0066 non dipendeva dal codice, la
0067 aggiunge solo colonne e non poteva rompere niente.

---

## 3. La riga in chiaro che non esiste -- passo ANNULLATO

**Non lanciare `npm run cifra-credenziali`: non serve.** Questo passo nasceva da
un conteggio mio sbagliato, e vale la pena scrivere l'errore invece di
cancellarlo.

Avevo contato le righe in chiaro con `google_refresh_token not like 'v1:%'`.
Il prefisso pero' e' `v1.` con il PUNTO (vedi `PREFISSO` in `src/lib/cifratura.ts`,
che unisce i quattro pezzi con `.`): il valore cifrato non somigliava al mio
pattern, quindi risultava "in chiaro". Una riga cifrata contata come non cifrata.

Il conteggio rifatto bene sulla produzione:

- collegamenti calendario totali: **1** (Google, stato `connesso`);
- `google_refresh_token` in chiaro: **0** -- il valore ha il prefisso `v1.` ed e'
  composto da 4 pezzi separati dal punto, cioe' esattamente il formato che
  produce `cifra()`;
- `google_access_token` in chiaro: **0**, stessa forma;
- `caldav_password` in chiaro: **0** (quella riga non e' CalDAV).

La lezione, piccola ma ripetibile: **un controllo che cerca un prefisso va
scritto copiando il prefisso dal codice, non a memoria.** Un carattere sbagliato
non fa fallire la query -- la fa rispondere con sicurezza la cosa opposta al
vero.

---

## 4. Il giro completo

```
./scripts/verifica.sh --e2e
```

Cosa deve dire:

| controllo | atteso |
|---|---|
| tipi, lint, build | verdi |
| test unitari | **1037** |
| permessi del database | **nessuna divergenza** (se lanci PRIMA del passo 2 ne segnala due: `collegamenti_calendario_esterni` ed `eventi_calendario_esterni`. E' la prova che lo script funziona) |
| scenari e2e deterministici | 53 verdi |
| scenario 30 | 7 verdi |

Lo **scenario 13** adesso e' piu' severo di stamattina: chiede al trigger di
registrazione tutte e cinque le cose che deve fare (tenant, profilo,
`membri_tenant`, 7 orari, regola promemoria), non piu' tre. Se diventa rosso
li', il messaggio ti dice quale pezzo manca.

---

## 5. Gli scenari che costano (decidi tu)

```
npx playwright test tests/e2e/0*.spec.ts tests/e2e/10-*.spec.ts
```

Sono gli scenari 1-10: chiamano il modello e costano qualche euro. Non li ho
lanciati. **Andrebbero fatti**: il motore degli slot e' cambiato oggi sotto
l'assistente (griglia ancorata all'apertura, stacco, orari per persona,
ferie) e nessuno ha ancora verificato che lo racconti bene al cliente.

---

## 6. L'unica cosa che i test non possono provare: l'export sul calendario

Il giro vero contro Google richiede un account collegato e l'OAuth, che
dall'ambiente di lavoro non si fa. Va provato a mano, cinque minuti:

1. `/dashboard/impostazioni/calendari`, collega un calendario Google di prova
   a un operatore.
2. Spunta **"Scrivi qui gli appuntamenti del salone"** (nasce spenta apposta).
3. Crea un appuntamento per quell'operatore dalla dashboard.
4. Guarda su Google: deve comparire, con titolo `Servizio - Cliente`, all'ora
   giusta. Nella descrizione **non** devono esserci telefono ne' email del
   cliente.
5. Sposta l'appuntamento: l'evento su Google si deve spostare, non
   duplicarsi.
6. Cancellalo: l'evento deve sparire.
7. **Il controllo che conta davvero**: torna sulla pagina pubblica e chiedi
   la disponibilita' di quell'operatore nello stesso giorno. Gli orari
   proposti devono essere gli stessi di prima -- se l'appuntamento esportato
   tornasse indietro come "impegno esterno", vedresti sparire il doppio degli
   slot. E' l'anello che il codice e' scritto per evitare, ed e' l'unica cosa
   che si vede solo dal vivo.

Se al punto 4 non compare niente: e' fail-open di proposito, quindi non trovi
un errore in faccia. Il motivo sta nei log Vercel, cerca `[calendari]`.

---

## 7. L'import della rubrica (nuovo, e conviene provarlo)

`/dashboard/clienti` -> **Importa rubrica**. Tre prove da tre minuti:

1. Incolla questo e premi "Vediamo cosa entra":

   ```
   Nome;Telefono;Email
   Maria Rossi;333 123 4567;maria@esempio.it
   Luca Bianchi;3339876543;
   nota a caso senza numero
   ```

   Devono uscire 2 clienti nuovi e 1 riga "che non ho capito" mostrata per
   esteso. Importa.

2. **Rifai lo stesso identico incolla**, ma scrivendo il primo numero come
   `+39 333 1234567`. Deve dirti che sono **gia' in rubrica**, non proporti
   di crearli di nuovo. E' il controllo che conta: se te li ripropone come
   nuovi, il confronto dei numeri non funziona e su trecento righe avresti la
   rubrica doppia.

3. Prova a entrare su `/dashboard/clienti/importa` con un account **staff**:
   deve rimandarti alla rubrica. L'import e' owner-only come l'export.
