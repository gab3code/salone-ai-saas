import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaSupabaseFinto } from "@/test/supabase-finto";
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

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

describe("eseguiStrumento -- info_attivita (Fase 2, knowledge base AI, Pro/Enterprise)", () => {
  it("con tutti i campi valorizzati e 2 FAQ restituisce tutto correttamente, inclusa una politica di cancellazione leggibile", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [
          {
            data: {
              descrizione: "Salone nel centro di Milano",
              indirizzo: "Via Roma 10, Milano",
              parcheggio: "Parcheggio gratuito nel cortile",
              metodi_pagamento: "Contanti e carte",
              ore_minime_cancellazione: 24,
              telefono: "0212345678",
            },
            error: null,
          },
        ],
      },
      faq_attivita: {
        select: [
          {
            data: [
              { domanda: "Fate anche extension?", risposta: "Sì, su appuntamento." },
              { domanda: "Siete aperti la domenica?", risposta: "No, siamo chiusi la domenica." },
            ],
            error: null,
          },
        ],
      },
    });

    const risultato = await eseguiStrumento("info_attivita", {}, { supabase, tenantId: TENANT_ID });

    expect(risultato).toEqual({
      descrizione: "Salone nel centro di Milano",
      indirizzo: "Via Roma 10, Milano",
      parcheggio: "Parcheggio gratuito nel cortile",
      metodi_pagamento: "Contanti e carte",
      politica_cancellazione:
        "Le cancellazioni sono possibili gratuitamente fino a 24 ore prima dell'appuntamento; oltre questo termine il cliente deve contattare direttamente l'attività (0212345678).",
      contatto_diretto: "0212345678",
      domande_frequenti: [
        { domanda: "Fate anche extension?", risposta: "Sì, su appuntamento." },
        { domanda: "Siete aperti la domenica?", risposta: "No, siamo chiusi la domenica." },
      ],
    });
    expect(String(risultato.politica_cancellazione)).toMatch(/24 ore/);
    expect(String(risultato.politica_cancellazione)).toMatch(/0212345678/);
  });

  it("con campi opzionali NULL e nessuna FAQ restituisce null/array vuoto, MAI un placeholder inventato dal codice", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [
          {
            data: {
              descrizione: null,
              indirizzo: null,
              parcheggio: null,
              metodi_pagamento: null,
              ore_minime_cancellazione: 24,
              telefono: null,
            },
            error: null,
          },
        ],
      },
      faq_attivita: { select: [{ data: [], error: null }] },
    });

    const risultato = await eseguiStrumento("info_attivita", {}, { supabase, tenantId: TENANT_ID });

    expect(risultato.descrizione).toBeNull();
    expect(risultato.indirizzo).toBeNull();
    expect(risultato.parcheggio).toBeNull();
    expect(risultato.metodi_pagamento).toBeNull();
    expect(risultato.contatto_diretto).toBeNull();
    expect(risultato.domande_frequenti).toEqual([]);
    // La politica di cancellazione resta comunque un dato REALE (ore_minime_cancellazione
    // ha un default di 24 nel database, non è un'invenzione del codice) -- ma senza
    // telefono non menziona nessun contatto tra parentesi.
    expect(risultato.politica_cancellazione).toBe(
      "Le cancellazioni sono possibili gratuitamente fino a 24 ore prima dell'appuntamento; oltre questo termine il cliente deve contattare direttamente l'attività."
    );
    expect(String(risultato.politica_cancellazione)).not.toMatch(/non disponibile/i);
  });

  it("tenant non trovato restituisce un errore esplicito", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: null, error: null }] },
      faq_attivita: { select: [{ data: [], error: null }] },
    });

    const risultato = await eseguiStrumento("info_attivita", {}, { supabase, tenantId: TENANT_ID });
    expect(risultato.errore).toBeDefined();
  });
});

describe("eseguiStrumento -- elenca_operatori include la descrizione (Fase 2)", () => {
  it("restituisce la descrizione/specializzazione di ogni operatore quando configurata", async () => {
    const supabase = creaSupabaseFinto({
      operatori: {
        select: [
          {
            data: [
              { id: "op-1", nome: "Mario", ruolo: "Barbiere", descrizione: "Specializzato in barba" },
              { id: "op-2", nome: "Anna", ruolo: "Colorista", descrizione: null },
            ],
            error: null,
          },
        ],
      },
    });

    const risultato = await eseguiStrumento("elenca_operatori", {}, { supabase, tenantId: TENANT_ID });

    expect(risultato).toEqual({
      operatori: [
        { id: "op-1", nome: "Mario", ruolo: "Barbiere", descrizione: "Specializzato in barba" },
        { id: "op-2", nome: "Anna", ruolo: "Colorista", descrizione: null },
      ],
    });
  });
});
