/**
 * Mappa piano <-> Stripe Price ID (Fase 5, collegata l'11/09/2026 su
 * richiesta di Gabriel). I Price ID vivono in env, mai hardcoded: sono
 * diversi tra l'account sandbox di test e un futuro account live, e diversi
 * ogni volta che si ricrea un prezzo. Vedi .env.example per i nomi delle
 * variabili -- vanno valorizzate DOPO aver creato i 3 prodotti/prezzi su
 * Stripe (Dashboard -> Product catalog), passaggio che va fatto a mano da
 * Gabriel: Claude non può creare oggetti reali su un account Stripe (azione
 * bloccata dal classificatore "Real-World Transactions").
 *
 * Free è gestito interamente dal nostro DB (piano='free' di default alla
 * creazione del tenant, mai un vero abbonamento Stripe -- zero rischio di
 * "abbonamento fantasma" per un piano che non si paga). Enterprise è a
 * preventivo (Prezzi.tsx, CTA "Richiedi info" -> email), gestito a mano,
 * nessun checkout self-service.
 *
 * Nessuna "server-only" qui apposta: sia il checkout route (server) sia la
 * pagina di registrazione (client, per capire quale piano è stato scelto
 * dall'URL `?piano=`) devono poter importare queste funzioni pure.
 */
export type PianoPagante = "starter" | "growth" | "pro";

export const PIANI_PAGANTI: PianoPagante[] = ["starter", "growth", "pro"];

export const ETICHETTA_PIANO: Record<PianoPagante, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

export function pianoEPagante(valore: string | null | undefined): valore is PianoPagante {
  return !!valore && (PIANI_PAGANTI as string[]).includes(valore);
}

function priceIdDaEnv(valore: string | undefined, nomeVar: string): string {
  if (!valore) {
    throw new Error(
      `${nomeVar} mancante in .env.local -- crea il prezzo su Stripe (Dashboard -> Product catalog) e incolla l'ID (price_...)`
    );
  }
  return valore;
}

export function priceIdPerPiano(piano: PianoPagante): string {
  switch (piano) {
    case "starter":
      return priceIdDaEnv(process.env.STRIPE_PRICE_STARTER, "STRIPE_PRICE_STARTER");
    case "growth":
      return priceIdDaEnv(process.env.STRIPE_PRICE_GROWTH, "STRIPE_PRICE_GROWTH");
    case "pro":
      return priceIdDaEnv(process.env.STRIPE_PRICE_PRO, "STRIPE_PRICE_PRO");
  }
}

/**
 * Price ID del secondo line item, "operatore extra": il prezzo base include
 * 1 operatore, ognuno oltre il primo costa una quota fissa in più.
 *
 * Storia, perché il perimetro è cambiato due volte:
 *  - 14/09/2026: introdotto SOLO su Pro, a 20€/operatore, per il costo SMS
 *    reale (Skebby) che scala con gli appuntamenti, che scalano con gli
 *    operatori -- vedi DECISIONS.md.
 *  - 16/09/2026: esteso a Starter (10€) e Growth (15€) su richiesta di
 *    Gabriel, dopo che era emersa l'asimmetria rimasta aperta su Starter
 *    ("operatori illimitati" a 19,90€ a prescindere da quanti sono).
 *    Attenzione: su Starter e Growth NON c'è nessun costo SMS da recuperare
 *    (`PIANI_CON_SMS` è solo pro/enterprise), quindi quelle due quote sono
 *    quasi interamente margine. Non è recupero di costo, è cattura di valore
 *    per posto di lavoro -- lo stesso modello di Booksy, che fa pagare per
 *    operatore già dal piano d'ingresso. Le cifre sono più basse proprio
 *    perché il costo sottostante non c'è.
 *
 * Prodotto/Price separato dal Price base (non una fascia di quantità sullo
 * stesso Price) apposta: sono due cose diverse (abbonamento base + add-on
 * quantificabile) e Stripe le fattura più chiaramente così sulla ricevuta.
 *
 * Restituisce `null` invece di lanciare quando la variabile non c'è: le
 * quote di Starter e Growth richiedono due Price nuovi che Gabriel deve
 * creare a mano su Stripe (Claude non può creare oggetti su un account
 * Stripe, vedi il commento in testa al file). Finché non esistono, quei due
 * piani semplicemente non hanno l'add-on e tutto il resto continua a
 * funzionare -- meglio di un errore che blocca la creazione di un operatore.
 */
export function priceIdOperatoreExtra(piano: PianoPagante): string | null {
  switch (piano) {
    case "starter":
      return process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA || null;
    case "growth":
      return process.env.STRIPE_PRICE_GROWTH_OPERATORE_EXTRA || null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO_OPERATORE_EXTRA || null;
  }
}

/**
 * Tutti i Price ID "operatore extra" configurati, qualunque piano.
 *
 * Serve a riconoscere un add-on GIÀ presente su un abbonamento anche quando
 * appartiene a un piano diverso da quello attuale: un salone che passa da
 * Starter a Growth con 4 operatori si porta dietro la riga "operatore extra
 * Starter" a 10€, e senza questo elenco la sincronizzazione non la
 * riconoscerebbe come add-on da sostituire -- continuerebbe a pagare 10€
 * invece di 15€, aggiungendo una seconda riga accanto alla prima.
 */
export function tuttiPriceIdOperatoreExtra(): string[] {
  return PIANI_PAGANTI.map((piano) => priceIdOperatoreExtra(piano)).filter(
    (id): id is string => id !== null
  );
}

// Trial prima del primo addebito, SOLO su Growth (decisione con Gabriel
// dell'11/09/2026, ristretta il 12/09/2026 -- prima copriva anche Pro):
// far provare l'assistente vero prima di pagare, non un trial "a copertura"
// su Starter che l'AI non ce l'ha comunque, e non sparso su più piani a
// pagamento -- Growth è il piano d'ingresso con l'AI, quello con cui la
// maggior parte dei saloni entra nel prodotto.
// Vedi DECISIONS.md per il calcolo costi che rende sostenibile il trial: il
// costo AI reale nel caso peggiore (~10gg di uso intenso) è pochi euro,
// briciole rispetto al prezzo del piano.
export function giorniDiProva(piano: PianoPagante): number | undefined {
  return piano === "growth" ? 10 : undefined;
}

// Ricostruisce il piano interno a partire dal Price ID Stripe di un
// abbonamento. Usato dal webhook: la fonte di verità su "che piano ha
// questo cliente" è il prezzo a cui è DAVVERO iscritto su Stripe in questo
// momento, non quello salvato l'ultima volta -- copre anche i cambi piano
// fatti dal customer portal, non solo quelli passati dal nostro checkout.
export function pianoPerPriceId(priceId: string): PianoPagante | null {
  const mappa: Partial<Record<string, PianoPagante>> = {
    [process.env.STRIPE_PRICE_STARTER ?? ""]: "starter",
    [process.env.STRIPE_PRICE_GROWTH ?? ""]: "growth",
    [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
  };
  return mappa[priceId] ?? null;
}
