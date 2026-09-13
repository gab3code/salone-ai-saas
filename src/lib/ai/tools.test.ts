import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eseguiStrumento, type ContestoStrumento } from "./tools";

// Un client fittizio che fa fallire il test se un percorso di validazione
// arriva davvero a interrogare il database -- ogni caso qui sotto deve
// fermarsi PRIMA della query, sui campi obbligatori mancanti (punto 7 di
// CLAUDE.md: l'AI non deve inventare dati, e uno strumento chiamato con
// input incompleto deve rifiutarsi in modo esplicito, non tentare di
// indovinare/proseguire).
const supabaseNonDovrebbeEssereChiamato = new Proxy(
  {},
  {
    get() {
      throw new Error("Il client Supabase non doveva essere usato per questo input non valido.");
    },
  }
) as unknown as SupabaseClient;

const ctx: ContestoStrumento = {
  supabase: supabaseNonDovrebbeEssereChiamato,
  tenantId: "11111111-1111-1111-1111-111111111111",
};

describe("eseguiStrumento -- validazione input prima di toccare il database", () => {
  it("crea_prenotazione senza cliente_telefono restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      { servizio_id: "s1", operatore_id: "o1", inizio: "2026-09-05T15:00" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("crea_prenotazione con un orario non valido restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      {
        servizio_id: "s1",
        operatore_id: "o1",
        inizio: "non-una-data",
        cliente_telefono: "3331234567",
      },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("modifica_prenotazione senza appuntamento_id restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "modifica_prenotazione",
      { operatore_id: "o1", inizio: "2026-09-05T15:00" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("cancella_prenotazione senza appuntamento_id restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento("cancella_prenotazione", {}, ctx);
    expect(risultato.errore).toBeDefined();
  });

  it("verifica_disponibilita senza servizio_ids restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento("verifica_disponibilita", { data: "2026-09-05" }, ctx);
    expect(risultato.errore).toBeDefined();
  });

  it("verifica_disponibilita con una data non valida restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "verifica_disponibilita",
      { servizio_ids: ["s1"], data: "non-una-data" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("verifica_disponibilita con il NOME del servizio invece del suo id restituisce un errore esplicito, non un crash", async () => {
    // Regressione: visto dal vivo il 02/09/2026 -- il modello ha passato
    // "taglio" (il nome) invece dell'uuid restituito da elenca_servizi, e la
    // query a Postgres falliva con "invalid input syntax for type uuid",
    // un'eccezione non gestita che rompeva l'intera richiesta HTTP (500)
    // invece di dare all'AI un errore su cui correggersi nello stesso turno.
    const risultato = await eseguiStrumento(
      "verifica_disponibilita",
      { servizio_ids: ["taglio"], data: "2026-09-05" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
    expect(String(risultato.errore)).toMatch(/elenca_servizi/);
  });

  it("crea_prenotazione con il NOME del servizio invece del suo id restituisce un errore esplicito, non un crash", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      { servizio_id: "taglio", operatore_id: "mario", inizio: "2026-09-05T15:00", cliente_telefono: "3331234567" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
    expect(String(risultato.errore)).toMatch(/elenca_servizi|elenca_operatori/);
  });

  it("cerca_prenotazioni_cliente senza telefono restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento("cerca_prenotazioni_cliente", {}, ctx);
    expect(risultato.errore).toBeDefined();
  });

  it("aggiungi_lista_attesa senza cliente_telefono restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento("aggiungi_lista_attesa", { servizio_id: "s1" }, ctx);
    expect(risultato.errore).toBeDefined();
  });

  it("aggiungi_lista_attesa con il NOME del servizio invece del suo id restituisce un errore esplicito, non un crash", async () => {
    const risultato = await eseguiStrumento(
      "aggiungi_lista_attesa",
      { servizio_id: "taglio", cliente_telefono: "3331234567" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
    expect(String(risultato.errore)).toMatch(/elenca_servizi/);
  });

  it("aggiungi_lista_attesa con una data_preferita non nel formato YYYY-MM-DD restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "aggiungi_lista_attesa",
      { servizio_id: "11111111-1111-1111-1111-111111111111", cliente_telefono: "3331234567", data_preferita: "domani" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("trasferisci_a_operatore non tocca il database e restituisce sempre il segnale", async () => {
    const risultato = await eseguiStrumento("trasferisci_a_operatore", { motivo: "richiesta esplicita" }, ctx);
    expect(risultato).toEqual({ trasferito: true, motivo: "richiesta esplicita" });
  });

  it("trasferisci_a_operatore senza motivo usa un valore di default, non un dato inventato", async () => {
    const risultato = await eseguiStrumento("trasferisci_a_operatore", {}, ctx);
    expect(risultato).toEqual({ trasferito: true, motivo: "Non specificato" });
  });
});
