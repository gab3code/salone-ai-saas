/**
 * Tetto di prenotazioni mensili per piano (punto 20 di CLAUDE.md: "il sistema
 * deve tecnicamente applicare i limiti") -- decisione presa con Gabriel il
 * 02/09/2026, vedi DECISIONS.md per il ragionamento completo. Leva di
 * prodotto/upsell, non di costo: una prenotazione costa quasi zero da
 * salvare (una riga nel database), quindi qui SOLO il piano Free ha un
 * tetto -- tutti gli altri piani restano deliberatamente illimitati su
 * questo fronte (diverso dalla quota AI in `src/lib/ai/limiti.ts`, che
 * invece esiste per una vera ragione di costo/abuso).
 *
 * Vive in `src/lib/` (non sotto `ai/`) perché si applica a OGNI creazione di
 * prenotazione -- dashboard o AI, stessa regola, stesso posto (punto 9 di
 * CLAUDE.md: "AI e calendario devono utilizzare la stessa booking engine").
 *
 * Conta le prenotazioni CREATE nel mese corrente (`created_at`), non quelle
 * il cui appuntamento CADE nel mese corrente (`inizio`) -- coerente con
 * un'idea di "quota di utilizzo mensile della piattaforma", stessa
 * impostazione già usata per la quota di messaggi AI.
 */
const TETTO_PRENOTAZIONI_MENSILI_PER_PIANO: Record<string, number> = {
  free: 60,
};

export function limiteMensilePrenotazioni(piano: string): number {
  return TETTO_PRENOTAZIONI_MENSILI_PER_PIANO[piano] ?? Infinity;
}

/**
 * "1 operatore" sul piano Free (Fase 5, trovato nel controllo promesse del
 * sito 13/09/2026): `Prezzi.tsx` elenca questo limite tra le caratteristiche
 * del piano Free, ma finché questa funzione non esisteva nessun codice lo
 * applicava davvero -- un tenant Free poteva creare operatori illimitati da
 * `/dashboard/configura`, una promessa scritta e mai controllata. Stessa
 * forma di `limiteMensilePrenotazioni` sopra (Record + fallback Infinity),
 * usata da `creaOperatore` in `dashboard/configura/azioni.ts`.
 */
const LIMITE_OPERATORI_PER_PIANO: Record<string, number> = {
  free: 1,
};

export function limiteOperatori(piano: string): number {
  return LIMITE_OPERATORI_PER_PIANO[piano] ?? Infinity;
}

/**
 * Quante persone possono avere un accesso alla dashboard di un'attività
 * (Fase 5, migrazione 0027). Il numero include il TITOLARE: 1 significa
 * "solo lui, nessun invito possibile".
 *
 * Da non confondere con `limiteOperatori` sopra: un "operatore" è un record
 * dell'agenda (chi eroga i servizi), un "membro" è un account che entra in
 * dashboard. Sono davvero due cose diverse -- una receptionist ha un accesso
 * e non eroga servizi, un collaboratore può erogare servizi e non usare mai
 * il gestionale.
 *
 * **Perché solo Free è limitato** (deciso con Gabriel il 16/09/2026, dopo
 * essere passati da un'ipotesi di gate su Pro e poi su Growth): dal
 * 16/09/2026 ogni operatore oltre il primo si paga su TUTTI i piani a
 * pagamento (10€ Starter, 15€ Growth, 20€ Pro -- vedi `priceIdOperatoreExtra`
 * in stripe/piani.ts). Il personale è quindi già monetizzato lì. Mettere
 * ANCHE un tetto agli accessi vorrebbe dire far pagare due volte la stessa
 * cosa e, peggio, frenare esattamente ciò che l'add-on per operatore serve a
 * vendere. Free resta a un solo accesso perché è già un piano da una persona
 * sola (un operatore, 60 prenotazioni al mese).
 */
const LIMITE_MEMBRI_PER_PIANO: Record<string, number> = {
  free: 1,
};

export function limiteMembri(piano: string): number {
  return LIMITE_MEMBRI_PER_PIANO[piano] ?? Infinity;
}

export function pianoHaTeam(piano: string): boolean {
  return limiteMembri(piano) === Infinity;
}

/**
 * Gate di piano per Analytics (Fase 3, trovato nel controllo promesse del
 * sito 13/09/2026, costruito il 14/09/2026): `Prezzi.tsx`/`Funzionalita.tsx`
 * pubblicizzano "Analytics -- Andamento prenotazioni e clienti nel tempo"
 * incluso da Growth in su. Stessa forma di `pianoHaTonoPersonalizzato` in
 * `src/lib/ai/limiti.ts` (Set + funzione dedicata), qui in `piani.ts` e non
 * in `ai/limiti.ts` perché non ha nulla a che fare con l'assistente AI.
 */
export const PIANI_CON_ANALYTICS = new Set(["growth", "pro", "enterprise"]);

export function pianoHaAnalytics(piano: string): boolean {
  return PIANI_CON_ANALYTICS.has(piano);
}

/**
 * Gate di piano per i Promemoria automatici (Fase 6, trovato nel controllo
 * promesse del sito 13/09/2026, costruito il 14/09/2026): `Prezzi.tsx`
 * elenca "Promemoria automatici" da Growth in su, `Funzionalita.tsx` lo
 * descrive esplicitamente come due cose ("Reminder prima dell'appuntamento
 * e follow-up ai clienti inattivi") -- entrambe usano questo stesso gate,
 * un solo posto invece di duplicare il controllo piano nel job schedulato
 * per ciascuna delle due. Stessa lista di piani di `PIANI_CON_ANALYTICS`
 * (coincidenza dei requisiti attuali, non un vincolo: i due Set restano
 * indipendenti apposta, un domani potrebbero divergere).
 */
export const PIANI_CON_PROMEMORIA = new Set(["growth", "pro", "enterprise"]);

export function pianoHaPromemoria(piano: string): boolean {
  return PIANI_CON_PROMEMORIA.has(piano);
}

/**
 * Gate di piano per il Contatto automatico della lista d'attesa (Fase 1,
 * deciso con Gabriel il 14/09/2026): quando un posto si libera e un cliente
 * in `lista_attesa` viene marcato "proposto" (`trovaEAvvisaListaAttesa` in
 * booking-engine.server.ts), il tenant può scegliere di farlo contattare
 * subito da Salone AI (email o SMS, stessa logica di fallback già usata per
 * le notifiche di prenotazione) invece che a mano dal titolare -- default
 * "manuale" per ogni tenant, questo gate decide solo CHI può attivare
 * l'automatico. Stessa lista piani di `PIANI_CON_PROMEMORIA` (coincidenza
 * dei requisiti attuali, non un vincolo) -- Set indipendente apposta, come
 * già `PIANI_CON_ANALYTICS`/`PIANI_CON_PROMEMORIA`: un domani potrebbero
 * divergere.
 */
export const PIANI_CON_LISTA_ATTESA_AUTOMATICA = new Set(["growth", "pro", "enterprise"]);

export function pianoHaListaAttesaAutomatica(piano: string): boolean {
  return PIANI_CON_LISTA_ATTESA_AUTOMATICA.has(piano);
}

/**
 * Gate di piano per SMS (Fase 5+SMS, deciso con Gabriel il 14/09/2026 --
 * vedi DECISIONS.md per il ragionamento completo su costi e prezzo per
 * operatore): `Prezzi.tsx` elenca "SMS" tra le voci di Pro. Usato SOLO come
 * canale di fallback quando un cliente non ha lasciato un'email (mai in
 * aggiunta all'email -- vedi src/lib/sms/invio.server.ts), sia per la
 * conferma di una nuova prenotazione (notifiche.server.ts) sia per i
 * Promemoria automatici (promemoria.ts/promemoria.server.ts). A differenza
 * degli altri gate booleani qui sopra, l'SMS costa soldi VERI per messaggio
 * (Skebby, vedi src/lib/sms/skebby.server.ts) -- da qui il tetto mensile
 * sotto, che gli altri canali (email, AI chat con un modello economico) non
 * hanno bisogno di avere.
 */
export const PIANI_CON_SMS = new Set(["pro", "enterprise"]);

export function pianoHaSms(piano: string): boolean {
  return PIANI_CON_SMS.has(piano);
}

/**
 * Tetto SMS mensile per tenant, proporzionale al numero di operatori
 * (deciso con Gabriel il 14/09/2026, DOPO aver corretto una prima stima
 * fissa troppo bassa -- 100 SMS/mese in totale non regge un salone Pro
 * davvero attivo, che ha prenotazioni illimitate: vedi DECISIONS.md per il
 * confronto costi Skebby/Twilio/WhatsApp e per come si è arrivati alla
 * scelta "il prezzo base include 1 operatore, +20€/mese ciascuno oltre il primo" in
 * priceIdOperatoreExtra, stripe/piani.ts). Un salone con più operatori
 * gestisce più appuntamenti e quindi manda più SMS a chi non ha lasciato
 * un'email, e paga già di più su Stripe per quegli operatori extra --
 * scalare anche la quota SMS con lo stesso numero mantiene il margine per
 * operatore costante invece di restringersi man mano che un salone cresce.
 * 100 SMS/operatore/mese è una prima stima prudente, non un numero
 * definitivo -- una riga sola da cambiare se il volume reale (oggi zero,
 * nessun cliente Pro reale ancora) si rivela diverso, stesso spirito già
 * dichiarato per QUOTA_MENSILE_MESSAGGI_PER_PIANO in ai/limiti.ts.
 */
const SMS_MENSILI_PER_OPERATORE = 100;

export function limiteMensileSms(piano: string, numeroOperatori: number): number {
  if (!pianoHaSms(piano)) return 0;
  return SMS_MENSILI_PER_OPERATORE * Math.max(1, numeroOperatori);
}

/**
 * Gate di piano per la Knowledge base dell'AI receptionist (Fase 2, deciso
 * con Gabriel il 15/09/2026): oltre alla chat AI transazionale già inclusa
 * da Growth in su (`pianoHaAccessoAIChatWeb` in `ai/limiti.ts`), Pro ed
 * Enterprise possono configurare informazioni generali sull'attività
 * (descrizione, parcheggio, metodi di pagamento, policy di cancellazione,
 * FAQ libere) che l'AI usa per rispondere a domande non transazionali --
 * leva di upsell rispetto alla chat base già inclusa da Growth. Gate NUOVO E
 * INDIPENDENTE (non lo stesso di `pianoHaTonoPersonalizzato`/`pianoHaSms` in
 * `ai/limiti.ts`, anche se i piani coincidono oggi): un tenant Growth
 * mantiene la chat AI transazionale di oggi, ma NON la capacità informativa.
 * Stesso stile di `PIANI_CON_LISTA_ATTESA_AUTOMATICA` sopra -- Set
 * indipendente apposta, un domani potrebbe divergere.
 */
export const PIANI_CON_KNOWLEDGE_BASE_AI = new Set(["pro", "enterprise"]);

export function pianoHaKnowledgeBaseAi(piano: string): boolean {
  return PIANI_CON_KNOWLEDGE_BASE_AI.has(piano);
}

/**
 * Gate di piano per il Promemoria di compleanno ("Automazioni extra
 * (promemoria di compleanno)", Pro/Enterprise). CONFLITTO trovato il
 * 15/09/2026 (vedi DECISIONS.md): la voce era già pubblicizzata in
 * `Prezzi.tsx` da prima del 12/09/2026, ma il codice non esisteva --
 * costruito lo stesso giorno dopo che Gabriel ha approvato la funzione con
 * la richiesta esplicita "rendi tutto personalizzabile dallo staff" (vedi
 * `tenants.compleanno_attivo`/`compleanno_messaggio`, migrazione 0023, e
 * `src/lib/compleanno.ts`/`compleanno.server.ts`). Gate NUOVO E
 * INDIPENDENTE dagli altri Set qui sopra (stessa lista piani di
 * `PIANI_CON_SMS` oggi, non un vincolo: potrebbero divergere in futuro) --
 * a differenza degli altri promemoria, un tenant su questo piano deve
 * ANCHE accendere esplicitamente `tenants.compleanno_attivo` (default
 * spento): questo gate decide solo CHI PUÒ attivarlo, non se è già attivo.
 */
export const PIANI_CON_PROMEMORIA_COMPLEANNO = new Set(["pro", "enterprise"]);

export function pianoHaPromemoriaCompleanno(piano: string): boolean {
  return PIANI_CON_PROMEMORIA_COMPLEANNO.has(piano);
}


/**
 * Listino, in centesimi. Sta QUI e non in `admin.ts` (dove è nato) perché lo
 * leggono due posti molto diversi: il pannello di piattaforma, per stimare i
 * ricavi, e la pagina dell'abbonamento, per dire a un salone quanto pagherà.
 * Due copie dello stesso listino divergono sempre, e divergono in silenzio.
 *
 * ATTENZIONE: la verità sulla fatturazione resta Stripe. Questa mappa serve a
 * mostrare cifre, non a incassarle. Se cambi un prezzo su Stripe e ti
 * dimentichi di qui, quello che il cliente legge prima di pagare non è quello
 * che gli verrà addebitato -- ed è il tipo di incoerenza che si nota subito.
 * Enterprise è a preventivo e non ha listino, quindi non compare.
 */
export const PREZZO_BASE_CENTESIMI: Record<string, number> = {
  free: 0,
  starter: 1990,
  growth: 3990,
  pro: 8990,
};

/** Quota mensile per ogni operatore oltre il primo, diversa per piano. */
export const PREZZO_OPERATORE_EXTRA_CENTESIMI: Record<string, number> = {
  starter: 1000,
  growth: 1500,
  pro: 2000,
};

/**
 * Quanto costa davvero un piano a un'attività che ha `operatori` persone.
 *
 * È la cifra che va mostrata prima di far scegliere, e non il solo prezzo
 * base: la quota per operatore cambia con il piano (10 su Starter, 15 su
 * Growth, 20 su Pro), quindi un salone con tre operatori che passa da Starter
 * a Growth non va da 19,90 a 39,90 -- va da 39,90 a 69,90. Mostrare solo la
 * base significherebbe fargli scoprire il resto sulla schermata di pagamento.
 */
export function prezzoMensileCentesimi(piano: string, operatori: number): number {
  const base = PREZZO_BASE_CENTESIMI[piano];
  if (base === undefined) return 0;
  const quota = PREZZO_OPERATORE_EXTRA_CENTESIMI[piano] ?? 0;
  return base + quota * Math.max(0, operatori - 1);
}

export function formatoEuroDaCentesimi(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
