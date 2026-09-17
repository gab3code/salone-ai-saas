import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GIORNI_CONSERVAZIONE_DATI_DEMO,
  MAX_CLONI_DEMO_AL_GIORNO,
  SLUG_DEMO_GROWTH,
  SLUG_DEMO_PRO,
  nuovoGruppoDemo,
  slugCloneDemo,
} from "@/lib/demo";

export interface EsitoPuliziaDemo {
  clientiCancellati: number;
  conversazioniCancellate: number;
  cloniCancellati: number;
}

/**
 * Cancella quello che i visitatori hanno lasciato nel salone dimostrativo.
 *
 * Chi prova la demo scrive il proprio nome e il proprio numero VERI: e' il
 * motivo per cui la demo funziona, ed e' anche il motivo per cui quei dati
 * non possono restare li'. Nessuno ci ha chiesto di conservarli, nessuno li
 * guardera' mai, e un archivio di contatti reali che si accumula da solo e'
 * solo un problema che aspetta.
 *
 * La regola puo' essere brutale -- si cancella TUTTO quello che sta in
 * `clienti` per un tenant dimostrativo oltre la soglia -- solo perche' nella
 * demo non c'e' nessun cliente seminato da noi: la migrazione 0042 crea
 * servizi, operatori, orari e FAQ, mai un cliente. Quindi tutto quello che
 * c'e' li' dentro l'ha scritto un visitatore. Se un giorno si volessero
 * recensioni finte sulla pagina della demo servirebbero clienti finti, e
 * questa regola andrebbe resa piu' selettiva PRIMA di seminarli.
 *
 * Gli appuntamenti se ne vanno da soli con il cliente (`on delete cascade`).
 * Le conversazioni no -- non hanno un cliente collegato -- quindi si
 * cancellano per data.
 */
export async function pulisciDatiDemo(
  admin: SupabaseClient,
  adesso: Date = new Date()
): Promise<EsitoPuliziaDemo> {
  const soglia = new Date(adesso.getTime() - GIORNI_CONSERVAZIONE_DATI_DEMO * 24 * 60 * 60 * 1000);

  // I cloni dei visitatori se ne vanno interi: cancellare il tenant porta
  // via in cascata appuntamenti, clienti, conversazioni, servizi e orari. E'
  // il vantaggio di aver isolato per tenant invece che per sessione -- la
  // pulizia e' una riga invece di un giro tabella per tabella.
  const { data: cloni } = await admin
    .from("tenants")
    .delete()
    .not("demo_clonato_da", "is", null)
    .lt("created_at", soglia.toISOString())
    .select("id");
  const cloniCancellati = cloni?.length ?? 0;

  // Sui due MODELLI invece il tenant resta e si cancella solo quello che i
  // visitatori hanno lasciato: capita quando il tetto giornaliero dei cloni
  // e' pieno e si ricade sul salone condiviso.
  const { data: demo } = await admin
    .from("tenants")
    .select("id")
    .eq("e_demo", true)
    .is("demo_clonato_da", null);
  const idDemo = (demo ?? []).map((t) => t.id as string);
  if (idDemo.length === 0) return { clientiCancellati: 0, conversazioniCancellate: 0, cloniCancellati };

  const { data: clienti } = await admin
    .from("clienti")
    .delete()
    .in("tenant_id", idDemo)
    .lt("created_at", soglia.toISOString())
    .select("id");

  const { data: conversazioni } = await admin
    .from("conversazioni")
    .delete()
    .in("tenant_id", idDemo)
    .lt("created_at", soglia.toISOString())
    .select("id");

  return {
    clientiCancellati: clienti?.length ?? 0,
    conversazioniCancellate: conversazioni?.length ?? 0,
    cloniCancellati,
  };
}


export interface SaloneDemoDelVisitatore {
  gruppo: string | null;
  slugGrowth: string;
  slugPro: string;
  /** false quando si e' ricaduti sul salone condiviso (tetto giornaliero pieno). */
  suoSoltanto: boolean;
}

/** I due modelli condivisi: il ripiego quando non si puo' clonare. */
const CONDIVISO: SaloneDemoDelVisitatore = {
  gruppo: null,
  slugGrowth: SLUG_DEMO_GROWTH,
  slugPro: SLUG_DEMO_PRO,
  suoSoltanto: false,
};

/**
 * Il salone demo di QUESTO visitatore: quello che aveva gia', o due cloni
 * nuovi.
 *
 * Perche' un salone a testa invece di uno condiviso (Gabriel, 17/09/2026:
 * "ma e' una demo uguale per tutti? se e' cosi' non va bene"): con una demo
 * sola, chi prenota martedi' alle 15 la toglie a tutti quelli che arrivano
 * dopo, e con un po' di traffico la demo sembra sempre piena. L'isolamento
 * non e' stato costruito filtrando dentro il motore di prenotazione -- che
 * legge `appuntamenti` in nove punti e ha il vincolo anti-doppia-prenotazione
 * a livello di database -- ma riusando la separazione per tenant che il
 * prodotto ha gia' e gia' testa. Il clone E' un salone vero.
 *
 * Due cloni per visitatore, Growth e Pro, legati dallo stesso `demo_gruppo`:
 * servono entrambi perche' l'interruttore in cima alla pagina deve poter
 * passare dall'uno all'altro senza perdere quello che si e' appena provato.
 */
export async function ottieniOCreaSaloneDemo(
  admin: SupabaseClient,
  gruppoDalCookie: string | null
): Promise<SaloneDemoDelVisitatore> {
  if (gruppoDalCookie) {
    const { data } = await admin
      .from("tenants")
      .select("slug, piano")
      .eq("demo_gruppo", gruppoDalCookie)
      .eq("e_demo", true);
    const growth = data?.find((t) => t.piano === "growth")?.slug;
    const pro = data?.find((t) => t.piano === "pro")?.slug;
    // Se la pulizia notturna li ha gia' portati via, il cookie punta al
    // nulla: si riparte come un visitatore nuovo invece di mostrare un 404.
    if (growth && pro) {
      return { gruppo: gruppoDalCookie, slugGrowth: growth, slugPro: pro, suoSoltanto: true };
    }
  }

  // Tetto giornaliero: creare tenant da una pagina pubblica senza login e'
  // comodo e pericoloso. Superato il tetto si serve il salone condiviso --
  // peggiore, ma vivo -- invece di negare la demo.
  const inizioGiorno = new Date();
  inizioGiorno.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .not("demo_clonato_da", "is", null)
    .gte("created_at", inizioGiorno.toISOString());
  if ((count ?? 0) >= MAX_CLONI_DEMO_AL_GIORNO) return CONDIVISO;

  const gruppo = nuovoGruppoDemo();
  const slugGrowth = slugCloneDemo(gruppo, "growth");
  const slugPro = slugCloneDemo(gruppo, "pro");

  const { error: erroreGrowth } = await admin.rpc("crea_clone_demo", {
    p_modello_slug: SLUG_DEMO_GROWTH,
    p_slug: slugGrowth,
    p_gruppo: gruppo,
  });
  if (erroreGrowth) return CONDIVISO;

  const { error: errorePro } = await admin.rpc("crea_clone_demo", {
    p_modello_slug: SLUG_DEMO_PRO,
    p_slug: slugPro,
    p_gruppo: gruppo,
  });
  if (errorePro) {
    // Mezzo gruppo non serve a niente: l'interruttore porterebbe a una
    // pagina che non esiste. Si butta via il primo e si ripiega.
    await admin.from("tenants").delete().eq("demo_gruppo", gruppo);
    return CONDIVISO;
  }

  return { gruppo, slugGrowth, slugPro, suoSoltanto: true };
}
