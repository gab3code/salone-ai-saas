import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chiave,
  confronta,
  leggiIstruzioni,
  permessiAttesi,
  tabelleDichiarate,
  type StatoPermessi,
} from "./permessi-attesi";

const RUOLI = ["anon", "authenticated"];

describe("leggere le istruzioni dalle migrazioni", () => {
  it("riconosce un grant su una tabella", () => {
    const [i] = leggiIstruzioni("grant select, insert on public.clienti to authenticated;");
    expect(i.tipo).toBe("grant");
    expect(i.privilegi).toEqual(["SELECT", "INSERT"]);
    expect(i.bersaglio).toEqual({ tipo: "tabella", nome: "clienti" });
    expect(i.ruoli).toEqual(["authenticated"]);
  });

  it("riconosce piu' ruoli sulla stessa riga", () => {
    const [i] = leggiIstruzioni("revoke delete on public.tenants from anon, authenticated;");
    expect(i.ruoli).toEqual(["anon", "authenticated"]);
  });

  it("riconosce i grant di colonna", () => {
    const [i] = leggiIstruzioni("grant update (nome, slug) on public.tenants to authenticated;");
    expect(i.colonne).toEqual(["nome", "slug"]);
    expect(i.privilegi).toEqual(["UPDATE"]);
  });

  it("riconosce 'all tables in schema public'", () => {
    const [i] = leggiIstruzioni("revoke insert, update, delete on all tables in schema public from anon;");
    expect(i.bersaglio).toEqual({ tipo: "tutte" });
  });

  it("ignora funzioni, sequenze e schema", () => {
    // Hanno semantiche diverse: confonderle darebbe un confronto sbagliato,
    // che e' peggio di nessun confronto.
    expect(leggiIstruzioni("revoke all on function pulisci_limiti_ip() from anon;")).toEqual([]);
    expect(leggiIstruzioni("grant usage on schema public to anon, authenticated;")).toEqual([]);
    expect(leggiIstruzioni("grant usage, select on all sequences in schema public to service_role;")).toEqual([]);
  });

  it("un'istruzione non riconosciuta non si mangia quella dopo", () => {
    // Il difetto trovato dal primo confronto vero (18/09/2026): la riga
    // `grant usage on schema public` non ha un bersaglio valido, e senza il
    // confine del punto e virgola la ricerca proseguiva fino all'`on` della
    // riga successiva, inghiottendo il grant su `tenants`. Risultato: il
    // confronto denunciava un permesso di troppo in produzione che invece
    // era dichiarato dalla 0005 da sempre.
    const istruzioni = leggiIstruzioni(
      "grant usage on schema public to anon, authenticated;\n" +
        "grant select, insert, update, delete on public.tenants to authenticated;"
    );
    expect(istruzioni).toHaveLength(1);
    expect(istruzioni[0].bersaglio).toEqual({ tipo: "tabella", nome: "tenants" });
    expect(istruzioni[0].privilegi).toEqual(["SELECT", "INSERT", "UPDATE", "DELETE"]);
  });

  it("`alter default privileges` non e' un permesso su una tabella chiamata 'tables'", () => {
    const istruzioni = leggiIstruzioni(
      "alter default privileges in schema public revoke select on tables from anon;\n" +
        "grant select on public.servizi to authenticated;"
    );
    expect(istruzioni).toHaveLength(1);
    expect(istruzioni[0].bersaglio).toEqual({ tipo: "tabella", nome: "servizi" });
    expect(tabelleDichiarate("alter default privileges in schema public revoke select on tables from anon;")).toEqual([]);
  });

  it("ignora quello che sta dentro un commento", () => {
    expect(leggiIstruzioni("-- grant select on public.clienti to anon;\n")).toEqual([]);
  });
});

describe("lo stato finale dipende dall'ordine", () => {
  it("l'ultima istruzione vince", () => {
    const stato = permessiAttesi(
      [
        "create table clienti (id uuid);",
        "grant select on public.clienti to authenticated;",
        "revoke select on public.clienti from authenticated;",
      ],
      RUOLI
    );
    expect(stato.get(chiave("clienti", "authenticated"))?.tabella.has("SELECT")).toBe(false);
  });

  it("'all tables' tocca tutte le tabelle dichiarate", () => {
    const stato = permessiAttesi(
      [
        "create table clienti (id uuid); create table servizi (id uuid);",
        "grant insert on all tables in schema public to authenticated;",
      ],
      RUOLI
    );
    expect(stato.get(chiave("clienti", "authenticated"))?.tabella.has("INSERT")).toBe(true);
    expect(stato.get(chiave("servizi", "authenticated"))?.tabella.has("INSERT")).toBe(true);
  });

  it("UNA REVOCA SULLA TABELLA PORTA VIA ANCHE I GRANT DI COLONNA", () => {
    // La trappola che ha morso davvero nella prima versione della 0049:
    // annullava la 0030 e il titolare non poteva piu' cambiare il nome del
    // proprio salone. Se questo test sparisce, sparisce l'unico posto in cui
    // quella regola e' scritta in modo verificabile.
    const stato = permessiAttesi(
      [
        "create table tenants (id uuid);",
        "grant update (nome, slug) on public.tenants to authenticated;",
        "revoke update on public.tenants from authenticated;",
      ],
      RUOLI
    );
    const permessi = stato.get(chiave("tenants", "authenticated"));
    expect(permessi?.colonne.get("UPDATE")).toBeUndefined();
  });

  it("un grant di colonna dopo la revoca invece resta", () => {
    const stato = permessiAttesi(
      [
        "create table tenants (id uuid);",
        "revoke update on public.tenants from authenticated;",
        "grant update (nome) on public.tenants to authenticated;",
      ],
      RUOLI
    );
    expect([...(stato.get(chiave("tenants", "authenticated"))?.colonne.get("UPDATE") ?? [])]).toEqual(["nome"]);
  });
});

describe("il confronto", () => {
  function stato(voci: [string, string, string[]][]): StatoPermessi {
    const m: StatoPermessi = new Map();
    for (const [tabella, ruolo, privilegi] of voci) {
      m.set(chiave(tabella, ruolo), {
        tabella: new Set(privilegi as never[]),
        colonne: new Map(),
      });
    }
    return m;
  }

  it("non dice niente quando combaciano", () => {
    const uguale = stato([["clienti", "authenticated", ["SELECT"]]]);
    expect(confronta(uguale, uguale, ["clienti"], ["authenticated"])).toEqual([]);
  });

  it("segnala un permesso che nel database c'e' e nei file no", () => {
    // E' il caso della 0051: la revoca c'era nel file, in produzione no.
    const divergenze = confronta(
      stato([]),
      stato([["clienti", "authenticated", ["SELECT"]]]),
      ["clienti"],
      ["authenticated"]
    );
    expect(divergenze).toEqual([
      { tabella: "clienti", ruolo: "authenticated", privilegio: "SELECT", atteso: false, reale: true },
    ]);
  });

  it("segnala anche il contrario: nei file c'e', nel database no", () => {
    // E' il caso della 0030 al rovescio, e rompe il prodotto invece di
    // aprirlo: va visto lo stesso.
    const divergenze = confronta(
      stato([["servizi", "authenticated", ["UPDATE"]]]),
      stato([]),
      ["servizi"],
      ["authenticated"]
    );
    expect(divergenze[0]).toMatchObject({ privilegio: "UPDATE", atteso: true, reale: false });
  });

  it("non fa rumore su TRUNCATE, REFERENCES e TRIGGER", () => {
    // Restano addosso ai ruoli per default di Supabase e non permettono ne'
    // di leggere ne' di scrivere righe. Un controllo rumoroso e' un controllo
    // che si smette di leggere.
    const divergenze = confronta(
      stato([]),
      stato([["clienti", "anon", ["TRUNCATE", "REFERENCES", "TRIGGER"]]]),
      ["clienti"],
      ["anon"]
    );
    expect(divergenze).toEqual([]);
  });
});

describe("contro le migrazioni vere del progetto", () => {
  const cartella = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");
  const migrazioni = readdirSync(cartella)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => readFileSync(join(cartella, n), "utf8"));

  it("le migrazioni si leggono e dichiarano le tabelle che ci aspettiamo", () => {
    const tabelle = tabelleDichiarate(migrazioni.join("\n"));
    expect(tabelle).toContain("clienti");
    expect(tabelle).toContain("profiles");
    expect(tabelle).toContain("tenants");
    expect(tabelle.length).toBeGreaterThan(20);
  });

  it("dopo la 0057 `anon` non legge gli orari dello staff", () => {
    // Una tabella nuova nasce con i default dello schema: senza la revoca
    // esplicita nella 0057, la chiave pubblica leggerebbe chi lavora quando
    // in ogni salone. Il test guarda i file, il confronto con `npm run
    // permessi` guarda il database: servono tutti e due.
    const stato = permessiAttesi(migrazioni, RUOLI);
    expect(stato.get(chiave("orari_operatore", "anon"))?.tabella.has("SELECT") ?? false).toBe(false);
    expect(stato.get(chiave("orari_operatore", "authenticated"))?.tabella.has("SELECT")).toBe(true);
  });

  it("dopo la 0051 nessuno dei due ruoli pubblici legge o scrive `clienti`", () => {
    const stato = permessiAttesi(migrazioni, RUOLI);
    for (const ruolo of RUOLI) {
      const permessi = stato.get(chiave("clienti", ruolo));
      for (const privilegio of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
        expect(permessi?.tabella.has(privilegio) ?? false, `${ruolo} non deve avere ${privilegio}`).toBe(false);
      }
    }
  });

  it("dopo la 0052 `authenticated` legge il proprio profilo ma non lo scrive", () => {
    const stato = permessiAttesi(migrazioni, RUOLI);
    const permessi = stato.get(chiave("profiles", "authenticated"));
    expect(permessi?.tabella.has("SELECT")).toBe(true);
    expect(permessi?.tabella.has("UPDATE")).toBe(false);
    expect(permessi?.colonne.get("UPDATE")).toBeUndefined();
  });

  it("`authenticated` legge `tenants`: e' la dashboard di ogni salone", () => {
    // La controprova del difetto sopra, contro le migrazioni vere: se il
    // grant della 0005 tornasse a sparire dal calcolo, il confronto
    // ricomincerebbe a denunciare un permesso di troppo che non esiste.
    const stato = permessiAttesi(migrazioni, RUOLI);
    expect(stato.get(chiave("tenants", "authenticated"))?.tabella.has("SELECT")).toBe(true);
  });

  it("il titolare puo' ancora cambiare il nome del proprio salone (0030)", () => {
    // La controprova della trappola: se la 0049 riannullasse la 0030, qui si
    // vedrebbe subito.
    const stato = permessiAttesi(migrazioni, RUOLI);
    const permessi = stato.get(chiave("tenants", "authenticated"));
    expect(permessi?.colonne.get("UPDATE")?.has("nome")).toBe(true);
  });
});
