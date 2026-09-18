import { describe, expect, it, vi, beforeEach } from "vitest";
import { creaClientAdmin } from "@/lib/supabase/admin";
import * as collegamenti from "./collegamenti.server";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: vi.fn() }));
vi.mock("./caldav.server", () => ({
  verificaCredenzialiCaldav: vi.fn().mockResolvedValue({
    ok: true,
    valore: { calendari: [{ href: "https://caldav.esempio/cal/1" }] },
  }),
  recuperaIcsGrezzo: vi.fn().mockResolvedValue({ ok: false, errore: "non risponde" }),
}));
vi.mock("./google.server", () => ({
  recuperaImpegniGoogle: vi.fn().mockResolvedValue([]),
  rinnovaTokenGoogle: vi.fn(),
}));

/**
 * Il test che tiene in piedi la chiusura dei calendari (migrazione 0065).
 *
 * Gemello di clienti.server.test.ts, e per lo stesso motivo: tolti ad
 * `authenticated` i permessi su `collegamenti_calendario_esterni`, sotto
 * queste query non c'e' piu' nessuna policy RLS. Se una dimenticasse
 * `.eq("tenant_id", ...)`, un salone vedrebbe i collegamenti di un altro --
 * cioe' la password CalDAV e il refresh token Google di una persona che non
 * conosce -- e niente lo fermerebbe.
 *
 * Il filtro non e' piu' una ridondanza: e' l'unica difesa rimasta. Quindi lo
 * verifica un test, non la memoria di chi scrivera' la prossima funzione.
 *
 * L'ultimo test e' il piu' importante: confronta le funzioni esportate con
 * quelle coperte qui, cosi' una funzione aggiunta domani e dimenticata fa
 * fallire la suite invece di passare in silenzio.
 */

interface Query {
  tabella: string;
  filtri: { colonna: string; valore: unknown }[];
  payload: unknown;
}

function creaClientRegistrante(risposte: { data?: unknown; error?: { message: string } | null }[] = []) {
  const query: Query[] = [];
  let indice = 0;
  const ultima = () => query[query.length - 1];
  const risposta = () => {
    const r = risposte[indice] ?? {};
    indice += 1;
    return { data: r.data ?? null, error: r.error ?? null };
  };

  const catena: Record<string, unknown> = {};
  Object.assign(catena, {
    select: () => catena,
    eq: (colonna: string, valore: unknown) => {
      ultima().filtri.push({ colonna, valore });
      return catena;
    },
    in: (colonna: string, valore: unknown) => {
      ultima().filtri.push({ colonna, valore });
      return catena;
    },
    delete: () => catena,
    update: (payload: unknown) => {
      ultima().payload = payload;
      return catena;
    },
    upsert: (payload: unknown) => {
      ultima().payload = payload;
      return catena;
    },
    maybeSingle: async () => risposta(),
    then: (risolvi: (v: unknown) => unknown) => Promise.resolve(risposta()).then(risolvi),
  });

  return {
    client: {
      from: (tabella: string) => {
        query.push({ tabella, filtri: [], payload: null });
        return catena;
      },
    },
    query,
  };
}

const TENANT = "tenant-1";

beforeEach(() => {
  vi.clearAllMocks();
  // `collegaCaldav` cifra la password prima di salvarla: senza chiave
  // lancerebbe, ed e' giusto che lo faccia (vedi cifratura.ts). Qui ne serve
  // una qualunque, purche' di 32 byte.
  process.env.SALONE_CHIAVE_CIFRATURA = Buffer.alloc(32, 7).toString("base64");
});

/** Ogni voce: come si invoca la funzione, e cosa ci si aspetta di vedere. */
const INVOCAZIONI = [
  {
    nome: "elencaCollegamentiTenant",
    esegui: (c: never) => collegamenti.elencaCollegamentiTenant(TENANT, c),
    risposte: [{ data: [] }],
  },
  {
    nome: "collegaCaldav",
    esegui: (c: never) =>
      collegamenti.collegaCaldav(
        TENANT,
        { operatoreId: "op-1", serverUrl: "https://caldav.esempio", username: "a", password: "b" },
        c
      ),
    risposte: [{ data: null }],
  },
  {
    nome: "scollegaCalendario",
    esegui: (c: never) => collegamenti.scollegaCalendario(TENANT, "coll-1", c),
    risposte: [{ data: null }],
  },
  {
    nome: "caricaImpegniEsterni",
    esegui: (c: never) =>
      collegamenti.caricaImpegniEsterni(
        TENANT,
        ["op-1"],
        new Date("2026-09-20T08:00:00Z"),
        new Date("2026-09-20T18:00:00Z"),
        "Europe/Rome",
        c
      ),
    risposte: [{ data: [] }],
  },
] as const;

describe("ogni query filtra sul tenant", () => {
  for (const invocazione of INVOCAZIONI) {
    it(`${invocazione.nome} non interroga mai la tabella senza tenant_id`, async () => {
      const { client, query } = creaClientRegistrante([...invocazione.risposte]);
      await invocazione.esegui(client as never);

      const sullaTabella = query.filter((q) => q.tabella === "collegamenti_calendario_esterni");
      expect(sullaTabella.length, "nessuna query registrata: il test non sta provando niente").toBeGreaterThan(0);
      for (const q of sullaTabella) {
        const perTenant = q.filtri.find((f) => f.colonna === "tenant_id");
        const perId = q.filtri.find((f) => f.colonna === "id");
        const tenantNelPayload = (q.payload as { tenant_id?: unknown } | null)?.tenant_id;

        // Tre forme legittime, e nessuna quarta:
        //  - legge/cancella filtrando sul tenant;
        //  - scrive una riga nuova mettendoci dentro il tenant;
        //  - aggiorna per `id`, ma solo un id appena uscito da una query gia'
        //    filtrata sul tenant (gli update di `ultimo_errore` dentro
        //    caricaImpegniEsterni fanno cosi').
        expect(
          perTenant?.valore ?? tenantNelPayload ?? perId,
          `query su collegamenti_calendario_esterni senza tenant ne' id in ${invocazione.nome}`
        ).toBeTruthy();
        if (perTenant) expect(perTenant.valore).toBe(TENANT);
        if (tenantNelPayload !== undefined) expect(tenantNelPayload).toBe(TENANT);
      }
    });
  }
});

describe("un tenant mancante non passa", () => {
  it("elencaCollegamentiTenant con tenant vuoto lancia invece di leggere tutto", async () => {
    const { client } = creaClientRegistrante([{ data: [] }]);
    await expect(collegamenti.elencaCollegamentiTenant("", client as never)).rejects.toThrow(/tenantId mancante/);
  });

  it("scollegaCalendario con tenant vuoto lancia invece di cancellare a caso", async () => {
    const { client } = creaClientRegistrante([{ data: null }]);
    await expect(collegamenti.scollegaCalendario("  ", "coll-1", client as never)).rejects.toThrow(
      /tenantId mancante/
    );
  });
});

describe("il client di default", () => {
  it("senza client esplicito usa quello admin, non quello dell'utente", async () => {
    // E' il punto di tutta la migrazione 0065: l'utente non ha piu' permessi
    // su questa tabella, quindi il modulo DEVE costruirsi il suo.
    const { client } = creaClientRegistrante([{ data: [] }]);
    vi.mocked(creaClientAdmin).mockReturnValue(client as never);

    await collegamenti.elencaCollegamentiTenant(TENANT);

    expect(creaClientAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("fail-open sul client", () => {
  it("SE IL CLIENT ADMIN NON SI PUO' COSTRUIRE, le prenotazioni continuano a funzionare", async () => {
    // La rete che serve a non trasformare "niente impegni esterni" in
    // "niente orari liberi". Prima del 18/09/2026 questa funzione riceveva
    // il client e non poteva fallire nel costruirlo; adesso se lo costruisce
    // da sola, e un ambiente senza SUPABASE_SERVICE_ROLE_KEY farebbe
    // esplodere il calcolo della disponibilita' -- cioe' spegnerebbe le
    // prenotazioni per un problema di configurazione.
    vi.mocked(creaClientAdmin).mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");
    });

    const impegni = await collegamenti.caricaImpegniEsterni(
      TENANT,
      ["op-1"],
      new Date("2026-09-20T08:00:00Z"),
      new Date("2026-09-20T18:00:00Z"),
      "Europe/Rome"
    );

    expect(impegni).toEqual([]);
  });

  it("un tenant mancante invece LANCIA, anche qui", async () => {
    // L'asimmetria e' voluta: un client assente fa perdere gli impegni
    // esterni, un tenant assente farebbe calcolare la disponibilita' sul
    // salone sbagliato.
    const { client } = creaClientRegistrante([{ data: [] }]);
    await expect(
      collegamenti.caricaImpegniEsterni(
        "",
        ["op-1"],
        new Date("2026-09-20T08:00:00Z"),
        new Date("2026-09-20T18:00:00Z"),
        "Europe/Rome",
        client as never
      )
    ).rejects.toThrow(/tenantId mancante/);
  });
});

describe("copertura", () => {
  it("ogni funzione esportata ha il suo test sul filtro tenant", () => {
    const esportate = Object.entries(collegamenti)
      .filter(([, valore]) => typeof valore === "function")
      .map(([nome]) => nome)
      .sort();
    const coperte = INVOCAZIONI.map((i) => i.nome as string).sort();

    expect(
      esportate,
      "una funzione nuova in collegamenti.server.ts va aggiunta a INVOCAZIONI: senza il suo test, il filtro sul tenant non e' verificato da nessuno"
    ).toEqual(coperte);
  });
});
