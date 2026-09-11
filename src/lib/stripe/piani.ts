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

// Trial prima del primo addebito, SOLO sui piani con AI (decisione con
// Gabriel dell'11/09/2026): far provare l'assistente vero prima di pagare,
// non un trial "a copertura" su Starter che l'AI non ce l'ha comunque.
// Vedi DECISIONS.md per il calcolo costi che rende sostenibile il trial: il
// costo AI reale nel caso peggiore (~10gg di uso intenso) è pochi euro,
// briciole rispetto al prezzo del piano.
export function giorniDiProva(piano: PianoPagante): number | undefined {
  return piano === "growth" || piano === "pro" ? 10 : undefined;
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
