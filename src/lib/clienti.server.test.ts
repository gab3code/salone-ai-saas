import { describe, expect, it, vi, beforeEach } from "vitest";
import { creaClientAdmin } from "@/lib/supabase/admin";
import * as clienti from "./clienti.server";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: vi.fn() }));

/**
 * Il test che tiene in piedi la chiusura della rubrica (Fase 6,
 * migrazione 0051).
 *
 * Togliendo ad `authenticated` i permessi su `clienti`, la rete di RLS sotto
 * queste query sparisce: se una di loro dimenticasse `.eq("tenant_id", ...)`,
 * un salone vedrebbe la rubrica di un altro e nessuno strato piu' in basso lo
 * fermerebbe. Il filtro non e' piu' una ridondanza, e' l'unica difesa rimasta
 * -- quindi va verificato da un test, non dalla buona memoria di chi scrive
 * la prossima funzione.
 *
 * Per questo il client finto qui sotto REGISTRA i filtri, cosa che
 * `@/test/supabase-finto` deliberatamente non fa (li' interessa il dato che
 * torna, non il filtro; qui e' l'esatto contrario). E li registra UNA QUERY
 * ALLA VOLTA: alcune funzioni ne fanno piu' d'una (`trovaOCreaCliente` ne fa
 * fino a tre), e "da qualche parte c'era un filtro" non e' la garanzia che
 * serve -- serve che ce l'abbia ognuna.
 *
 * L'ultimo test del file e' il piu' importante: confronta le funzioni
 * esportate con quelle coperte, cosi' una funzione aggiunta domani e
 * dimenticata qui fa fallire la suite invece di passare in silenzio.
 */

interface Query {
  tabella: string;
  operazione: string;
  filtri: { colonna: string; valore: unknown }[];
  payload: unknown;
  or: string[];
}

/**
 * Catena finta in stile PostgREST: ogni metodo torna se stesso, e l'oggetto
 * e' "thenable" perche' il codice sotto test a volte fa `await query` dopo
 * `.order()`, a volte chiude con `.maybeSingle()`. Il `then` risolve un
 * oggetto PIATTO, mai la catena: risolvere se stessa sarebbe un ciclo.
 *
 * `from()` apre una query nuova; tutto il resto si attacca all'ultima aperta.
 */
function creaClientRegistrante(risposte: { data?: unknown; error?: { message: string } | null }[] = []) {
  const query: Query[] = [];
  let indiceRisposta = 0;

  const ultima = (): Query => query[query.length - 1];

  function risposta() {
    const r = risposte[indiceRisposta] ?? {};
    indiceRisposta += 1;
    return { data: r.data ?? null, error: r.error ?? null };
  }

  const catena: Record<string, unknown> = {
    select: (campi?: string) => {
      // `.insert(...).select("id")` non e' una lettura: l'operazione della
      // query resta quella con cui e' stata aperta.
      if (ultima().operazione === "") ultima().operazione = "select";
      if (ultima().payload === undefined) ultima().payload = campi;
      return catena;
    },
    insert: (valori: unknown) => {
      ultima().operazione = "insert";
      ultima().payload = valori;
      return catena;
    },
    // Un upsert e' un insert che sa cosa fare in caso di conflitto: per il
    // confine del tenant vale la stessa regola, la riga deve portarselo
    // dentro. L'import lo usa per non far fallire trecento clienti a causa
    // di uno solo gia' presente.
    upsert: (valori: unknown) => {
      ultima().operazione = "insert";
      ultima().payload = valori;
      return catena;
    },
    update: (valori: unknown) => {
      ultima().operazione = "update";
      ultima().payload = valori;
      return catena;
    },
    delete: () => {
      ultima().operazione = "delete";
      return catena;
    },
    eq: (colonna: string, valore: unknown) => {
      ultima().filtri.push({ colonna, valore });
      return catena;
    },
    in: (colonna: string, valori: unknown) => {
      ultima().filtri.push({ colonna, valore: valori });
      return catena;
    },
    or: (espressione: string) => {
      ultima().or.push(espressione);
      return catena;
    },
    // `.is(colonna, null)`: il filtro "solo se vuoto" di completaClienteDoveVuoto.
    is: (colonna: string, valore: unknown) => {
      ultima().filtri.push({ colonna, valore });
      return catena;
    },
    order: () => catena,
    limit: () => catena,
    maybeSingle: () => Promise.resolve(risposta()),
    single: () => Promise.resolve(risposta()),
    then: (risolvi: (v: unknown) => unknown) => {
      const r = risposta();
      return Promise.resolve({ data: r.data ?? [], error: r.error }).then(risolvi);
    },
  };

  const client = {
    from: (tabella: string) => {
      query.push({ tabella, operazione: "", filtri: [], payload: undefined, or: [] });
      return catena;
    },
  };

  return { client: client as never, query };
}

const TENANT = "tenant-di-chi-chiede";

/**
 * Ogni voce e' una funzione esportata e il modo di invocarla con un tenant
 * dato. La lista serve due volte: per i test sul filtro e per il confronto
 * finale con gli export del modulo.
 *
 * `risposte` serve solo alle funzioni che si comportano diversamente a
 * seconda di cosa torna il database (trovaOCreaCliente: cliente trovato o no).
 */
interface Invocazione {
  nome: keyof typeof clienti;
  esegui: (tenantId: string, client: never) => Promise<unknown>;
  risposte?: { data?: unknown; error?: { message: string } | null }[];
}

const INVOCAZIONI: Invocazione[] = [
  { nome: "elencaClienti", esegui: (t, c) => clienti.elencaClienti(t, {}, c) },
  { nome: "caricaCliente", esegui: (t, c) => clienti.caricaCliente(t, "cliente-1", c) },
  { nome: "aggiornaCliente", esegui: (t, c) => clienti.aggiornaCliente(t, "cliente-1", { nome: "Anna" }, c) },
  { nome: "cancellaCliente", esegui: (t, c) => clienti.cancellaCliente(t, "cliente-1", c) },
  { nome: "clientiPerMetriche", esegui: (t, c) => clienti.clientiPerMetriche(t, c) },
  { nome: "dateCreazioneClienti", esegui: (t, c) => clienti.dateCreazioneClienti(t, c) },
  { nome: "nomiClientiPerId", esegui: (t, c) => clienti.nomiClientiPerId(t, ["cliente-1", "cliente-2"], c) },
  { nome: "trovaClientePerTelefono", esegui: (t, c) => clienti.trovaClientePerTelefono(t, "3331112222", c) },
  {
    // Cliente gia' in rubrica ma senza email: fa la lettura E l'aggiornamento,
    // cosi' il test vede due query invece di una.
    nome: "trovaOCreaCliente",
    esegui: (t, c) =>
      clienti.trovaOCreaCliente(t, { nome: "Anna", telefono: "3331112222", creatoDaAi: false, email: "a@b.it" }, c),
    risposte: [{ data: { id: "cliente-1", email: null } }, { error: null }],
  },
  {
    nome: "completaClienteDoveVuoto",
    esegui: (t, c) => clienti.completaClienteDoveVuoto(t, "cliente-1", { nome: "Anna", email: "a@b.it" }, c),
    risposte: [{ data: [{ id: "cliente-1" }] }, { data: [] }],
  },
  {
    // L'import inserisce PIU' righe in una volta: il confine del tenant deve
    // esserci su OGNUNA, non "da qualche parte nel payload".
    nome: "creaClientiInBlocco",
    esegui: (t, c) =>
      clienti.creaClientiInBlocco(
        t,
        [
          { nome: "Anna", telefono: "3331112222", email: null, note: null },
          { nome: "Bruno", telefono: "3333334444", email: null, note: null },
        ],
        c
      ),
    risposte: [{ data: [{ id: "cliente-1" }, { id: "cliente-2" }] }],
  },
];

/** Una query sulla rubrica e' legittima solo se dice a quale salone appartiene. */
function haIlConfineDelTenant(q: Query): boolean {
  if (q.filtri.some((f) => f.colonna === "tenant_id" && f.valore === TENANT)) return true;
  if (q.operazione !== "insert") return false;
  // Un insert non filtra: il confine lo scrive nella riga. Con piu' righe
  // deve esserci su TUTTE -- una sola riga senza tenant_id finirebbe nel
  // vuoto o, peggio, in un altro salone.
  const payload = q.payload as { tenant_id?: unknown } | { tenant_id?: unknown }[] | undefined;
  if (Array.isArray(payload)) {
    return payload.length > 0 && payload.every((r) => r?.tenant_id === TENANT);
  }
  return payload?.tenant_id === TENANT;
}

describe("clienti.server: il filtro sul tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const { nome, esegui, risposte } of INVOCAZIONI) {
    it(`${nome}: ogni query e' legata al tenant e tocca solo la tabella clienti`, async () => {
      const { client, query } = creaClientRegistrante(risposte);

      await esegui(TENANT, client);

      expect(query.length, `${nome} non ha interrogato niente: il test non sta verificando nulla`).toBeGreaterThan(0);
      for (const q of query) {
        expect(q.tabella, "nessuna query deve toccare altre tabelle").toBe("clienti");
        expect(
          haIlConfineDelTenant(q),
          `${nome}: una query (${q.operazione}) senza tenant_id -- cosi' si legge o si scrive la rubrica di un altro salone`
        ).toBe(true);
      }
    });

    it(`${nome} rifiuta un tenantId vuoto senza interrogare il database`, async () => {
      const { client, query } = creaClientRegistrante(risposte);

      await expect(esegui("   ", client)).rejects.toThrow(/tenantId mancante/);

      expect(query, "un tenantId vuoto non deve far partire nessuna query").toEqual([]);
    });
  }
});

describe("clienti.server: il client di default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("senza client esplicito usa quello admin, non uno costruito altrove", async () => {
    const { client } = creaClientRegistrante();
    vi.mocked(creaClientAdmin).mockReturnValue(client);

    await clienti.clientiPerMetriche(TENANT);

    expect(creaClientAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("clienti.server: la ricerca", () => {
  it("applica il filtro testuale solo quando un termine c'e' davvero", async () => {
    const senza = creaClientRegistrante();
    await clienti.elencaClienti(TENANT, { termine: null }, senza.client);
    expect(senza.query[0].or).toEqual([]);

    const con = creaClientRegistrante();
    await clienti.elencaClienti(TENANT, { termine: "anna" }, con.client);
    expect(con.query[0].or).toHaveLength(1);
    expect(haIlConfineDelTenant(con.query[0])).toBe(true);
  });
});

describe("clienti.server: i casi che il codice deve gestire da solo", () => {
  it("nomiClientiPerId non interroga niente se non ci sono id da cercare", async () => {
    const { client, query } = creaClientRegistrante();

    const mappa = await clienti.nomiClientiPerId(TENANT, [null, undefined, ""], client);

    expect(mappa.size).toBe(0);
    expect(query, "una lista vuota di id non deve diventare una query senza filtro").toEqual([]);
  });

  it("trovaOCreaCliente non sovrascrive un'email gia' presente", async () => {
    const { client, query } = creaClientRegistrante([{ data: { id: "cliente-1", email: "vecchia@salone.it" } }]);

    const esito = await clienti.trovaOCreaCliente(
      TENANT,
      { telefono: "3331112222", creatoDaAi: true, email: "nuova@salone.it" },
      client
    );

    expect(esito).toEqual({ id: "cliente-1" });
    expect(
      query.filter((q) => q.operazione === "update"),
      "l'email in rubrica puo' essere stata corretta a mano: una prenotazione non la cambia"
    ).toEqual([]);
  });

  it("trovaOCreaCliente scrive il tenant nella riga del cliente nuovo", async () => {
    // Un insert non ha un filtro dove mettere il confine: ce l'ha nella riga.
    // Se il tenant_id non ci fosse, il cliente nuovo nascerebbe senza salone
    // -- e la colonna e' NOT NULL, quindi in produzione sarebbe un errore a
    // prenotazione gia' quasi conclusa.
    const { client, query } = creaClientRegistrante([{ data: null }, { data: { id: "cliente-9" } }]);

    const esito = await clienti.trovaOCreaCliente(
      TENANT,
      { nome: "Anna", telefono: "3331112222", creatoDaAi: true },
      client
    );

    expect(esito).toEqual({ id: "cliente-9" });
    const inserimenti = query.filter((q) => q.operazione === "insert");
    expect(inserimenti).toHaveLength(1);
    expect((inserimenti[0].payload as { tenant_id?: unknown }).tenant_id).toBe(TENANT);
  });

  it("le metriche lanciano invece di calcolare su una rubrica tornata a meta'", async () => {
    const { client } = creaClientRegistrante([{ error: { message: "connessione persa" } }]);

    await expect(clienti.clientiPerMetriche(TENANT, client)).rejects.toThrow(/connessione persa/);
  });
});

describe("clienti.server: completare dove vuoto", () => {
  it("scrive un campo solo con il filtro 'is null' sulla stessa colonna, e conta solo le righe toccate", async () => {
    const { client, query } = creaClientRegistrante([{ data: [{ id: "cliente-1" }] }, { data: [] }]);

    const esito = await clienti.completaClienteDoveVuoto(TENANT, "cliente-1", { nome: "Anna", email: "a@b.it" }, client);

    expect(esito).toEqual({ scritti: 1, errore: null });
    expect(query).toHaveLength(2);
    expect(query[0].payload).toEqual({ nome: "Anna" });
    expect(query[0].filtri).toContainEqual({ colonna: "nome", valore: null });
    expect(query[1].payload).toEqual({ email: "a@b.it" });
    expect(query[1].filtri).toContainEqual({ colonna: "email", valore: null });
  });

  it("un campo vuoto o assente non produce nessuna query", async () => {
    const { client, query } = creaClientRegistrante([]);
    const esito = await clienti.completaClienteDoveVuoto(TENANT, "cliente-1", { nome: "  " }, client);
    expect(esito).toEqual({ scritti: 0, errore: null });
    expect(query).toEqual([]);
  });
});

describe("clienti.server: nessuna funzione scoperta", () => {
  it("ogni funzione esportata e' coperta dai test sul filtro", () => {
    const esportate = Object.entries(clienti)
      .filter(([, valore]) => typeof valore === "function")
      .map(([nome]) => nome)
      .sort();

    const coperte = INVOCAZIONI.map((i) => i.nome as string).sort();

    expect(
      esportate,
      "una funzione nuova in clienti.server.ts va aggiunta a INVOCAZIONI: senza il suo test, il filtro sul tenant non e' verificato da nessuno"
    ).toEqual(coperte);
  });
});
