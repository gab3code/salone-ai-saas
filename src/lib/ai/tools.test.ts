import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaSupabaseFinto } from "@/test/supabase-finto";

// Isola eseguiStrumento dalla logica interna di avvio pagamento caparra
// (già testata a fondo in src/lib/stripe/caparra.server.test.ts, inclusi i
// controlli di conflitto e la creazione della Checkout Session vera) -- qui
// interessa SOLO che crea_prenotazione si comporti bene in base a cosa
// restituisce questo modulo: che diramazione prenda, quali campi passi,
// come gestisca gli errori. Stesso principio già seguito per
// creaAppuntamentoTenant (mai duplicato, mai ri-testato qui).
vi.mock("@/lib/stripe/caparra.server", () => ({
  caricaImportoCaparraServizio: vi.fn(),
  avviaPagamentoCaparraTenant: vi.fn(),
}));
import { caricaImportoCaparraServizio, avviaPagamentoCaparraTenant } from "@/lib/stripe/caparra.server";

// Solo creaAppuntamentoTenant mockata (il resto del modulo resta reale, es.
// parsaOrarioLocale che eseguiStrumento usa direttamente) -- serve per
// verificare che il ramo "nessuna caparra" di crea_prenotazione chiami
// ancora la normale creazione dell'appuntamento, senza dover fornire tutto
// il fixture Supabase che creaAppuntamentoTenant si aspetterebbe (già
// coperto a fondo in booking-engine.server.test.ts).
vi.mock("@/lib/booking-engine.server", async (importOriginal) => {
  const reale = await importOriginal<typeof import("@/lib/booking-engine.server")>();
  return { ...reale, creaAppuntamentoTenant: vi.fn() };
});
import { creaAppuntamentoTenant } from "@/lib/booking-engine.server";
import { eseguiStrumento, type ContestoStrumento } from "./tools";

const caricaImportoCaparraServizioFinto = vi.mocked(caricaImportoCaparraServizio);
const avviaPagamentoCaparraTenantFinto = vi.mocked(avviaPagamentoCaparraTenant);
const creaAppuntamentoTenantFinto = vi.mocked(creaAppuntamentoTenant);

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
      { servizio_ids: ["s1"], operatore_id: "o1", inizio: "2026-09-05T15:00" },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("crea_prenotazione con un orario non valido restituisce un errore esplicito", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      {
        servizio_ids: ["s1"],
        operatore_id: "o1",
        inizio: "non-una-data",
        cliente_nome: "Mario Rossi",
        cliente_telefono: "3331234567",
      },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("crea_prenotazione senza cliente_nome restituisce un errore esplicito (richiesta di Gabriel dal vivo 15/09/2026: non solo il telefono)", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      {
        servizio_ids: ["11111111-1111-1111-1111-111111111111"],
        operatore_id: "11111111-1111-1111-1111-111111111111",
        inizio: "2026-09-05T15:00",
        cliente_telefono: "3331234567",
      },
      ctx
    );
    expect(risultato.errore).toBeDefined();
  });

  it("crea_prenotazione con cliente_nome vuoto/solo spazi restituisce un errore esplicito, non un cliente 'senza nome'", async () => {
    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      {
        servizio_ids: ["11111111-1111-1111-1111-111111111111"],
        operatore_id: "11111111-1111-1111-1111-111111111111",
        inizio: "2026-09-05T15:00",
        cliente_nome: "   ",
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
      {
        servizio_ids: ["taglio"],
        operatore_id: "mario",
        inizio: "2026-09-05T15:00",
        cliente_nome: "Mario Rossi",
        cliente_telefono: "3331234567",
      },
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

// Bug UX trovato dal vivo da Gabriel il 15/09/2026 (vedi DECISIONS.md): l'AI
// proponeva la lista d'attesa anche per un giorno in cui l'attività è
// semplicemente chiusa. La distinzione chiuso/pieno è già testata a fondo su
// trovaSlotEStatoGiornoTenant in booking-engine.server.test.ts -- qui basta
// verificare che eseguiStrumento inoltri davvero giorno_chiuso nel risultato
// (il collegamento stesso, non la logica sottostante).
describe("eseguiStrumento -- verifica_disponibilita inoltra giorno_chiuso (Fase 2, bug 15/09/2026)", () => {
  const SERVIZIO_ID = "66666666-6666-6666-6666-666666666666";

  it("giorno di chiusura settimanale: slot vuoto e giorno_chiuso true", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { fuso_orario: "Europe/Rome" }, error: null }] },
      orari_apertura: {
        select: [{ data: [{ giorno_settimana: 0, chiuso: true, apertura: null, chiusura: null, pausa_inizio: null, pausa_fine: null }], error: null }],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
    });

    // 2026-09-20 è una domenica (giorno_settimana 0).
    const risultato = await eseguiStrumento(
      "verifica_disponibilita",
      { servizio_ids: [SERVIZIO_ID], data: "2026-09-20" },
      { supabase, tenantId: TENANT_ID }
    );

    expect(risultato).toEqual({ slot: [], giorno_chiuso: true, giorno_settimana_richiesto: "domenica" });
  });

  it("giorno aperto ma senza operatori compatibili: slot vuoto e giorno_chiuso false", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { fuso_orario: "Europe/Rome" }, error: null }] },
      orari_apertura: {
        select: [
          {
            data: [{ giorno_settimana: 0, chiuso: false, apertura: "09:00:00", chiusura: "19:00:00", pausa_inizio: null, pausa_fine: null }],
            error: null,
          },
        ],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
    });

    const risultato = await eseguiStrumento(
      "verifica_disponibilita",
      { servizio_ids: [SERVIZIO_ID], data: "2026-09-20" },
      { supabase, tenantId: TENANT_ID }
    );

    expect(risultato).toEqual({ slot: [], giorno_chiuso: false, giorno_settimana_richiesto: "domenica" });
  });

  it("restituisce giorno_settimana_richiesto calcolato dalla data passata, non da 'oggi' (bug trovato dal vivo 15/09/2026, vedi giorni-settimana.test.ts)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { fuso_orario: "Europe/Rome" }, error: null }] },
      orari_apertura: {
        select: [{ data: [{ giorno_settimana: 6, chiuso: true, apertura: null, chiusura: null, pausa_inizio: null, pausa_fine: null }], error: null }],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
    });

    // 2026-09-19 è un sabato (giorno_settimana 6) -- non va confuso con la
    // domenica 20 dei due test sopra, esattamente il tipo di errore trovato
    // dal vivo.
    const risultato = await eseguiStrumento(
      "verifica_disponibilita",
      { servizio_ids: [SERVIZIO_ID], data: "2026-09-19" },
      { supabase, tenantId: TENANT_ID }
    );

    expect(risultato).toEqual({ slot: [], giorno_chiuso: true, giorno_settimana_richiesto: "sabato" });
  });
});

describe("eseguiStrumento -- crea_prenotazione con caparra attiva (bug trovato dal vivo il 15/09/2026: l'AI confermava senza pagamento)", () => {
  const SERVIZIO_ID = "44444444-4444-4444-4444-444444444444";
  const OPERATORE_ID = "55555555-5555-5555-5555-555555555555";
  const INPUT_VALIDO = {
    servizio_ids: [SERVIZIO_ID],
    operatore_id: OPERATORE_ID,
    inizio: "2026-09-19T12:00",
    cliente_nome: "Mario Rossi",
    cliente_telefono: "3331234567",
  };
  const CTX_CON_SLUG: ContestoStrumento = {
    supabase: supabaseNonDovrebbeEssereChiamato,
    tenantId: TENANT_ID,
    slug: "salone-test",
    origin: "https://esempio.it",
  };

  // Le mock queue (mockResolvedValueOnce) sono FIFO condivise tra i test di
  // questo file: senza un reset esplicito, un valore non consumato da un
  // test (es. perché l'asserzione fallisce prima) resterebbe in coda e
  // sporcherebbe il test successivo con un risultato inatteso.
  beforeEach(() => {
    caricaImportoCaparraServizioFinto.mockReset();
    avviaPagamentoCaparraTenantFinto.mockReset();
    creaAppuntamentoTenantFinto.mockReset();
  });

  it("se il servizio richiede una caparra, NON crea la prenotazione: avvia il pagamento e lo segnala", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(500); // 5,00€
    avviaPagamentoCaparraTenantFinto.mockResolvedValueOnce({
      ok: true,
      checkoutUrl: "https://checkout.stripe.com/sess_test",
      importoCentesimi: 500,
    });

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_VALIDO, CTX_CON_SLUG);

    expect(risultato).toEqual({
      richiede_pagamento: true,
      url_pagamento: "https://checkout.stripe.com/sess_test",
      importo_caparra_euro: 5,
    });
    // Il punto centrale del bug: creaAppuntamentoTenant non va MAI chiamata
    // in questo ramo, altrimenti la prenotazione risulterebbe comunque
    // confermata senza che il cliente abbia pagato.
    expect(creaAppuntamentoTenantFinto).not.toHaveBeenCalled();
    expect(avviaPagamentoCaparraTenantFinto).toHaveBeenCalledWith(
      expect.anything(), // il client supabase: identità non rilevante qui, testata a fondo altrove
      expect.objectContaining({
        tenantId: TENANT_ID,
        slug: "salone-test",
        origin: "https://esempio.it",
        servizioId: SERVIZIO_ID,
        operatoreId: OPERATORE_ID,
        clienteTelefono: "3331234567",
        clienteNome: "Mario Rossi",
      })
    );
  });

  it("se manca slug/origin nel contesto (non dovrebbe mai succedere in produzione), errore esplicito invece di procedere alla cieca", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(500);

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_VALIDO, ctx); // ctx SENZA slug/origin

    expect(risultato.errore).toBeDefined();
    expect(avviaPagamentoCaparraTenantFinto).not.toHaveBeenCalled();
    expect(creaAppuntamentoTenantFinto).not.toHaveBeenCalled();
  });

  it("se l'avvio del pagamento fallisce (es. conflitto d'orario), lo strumento propaga l'errore, mai una prenotazione fasulla", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(500);
    avviaPagamentoCaparraTenantFinto.mockResolvedValueOnce({
      ok: false,
      errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot.",
    });

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_VALIDO, CTX_CON_SLUG);

    expect(risultato).toEqual({ errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot." });
    expect(creaAppuntamentoTenantFinto).not.toHaveBeenCalled();
  });

  it("se il servizio NON richiede caparra, il comportamento resta invariato: crea la prenotazione direttamente", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(0);
    creaAppuntamentoTenantFinto.mockResolvedValueOnce({ ok: true, appuntamentoId: "appt-1" });

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_VALIDO, CTX_CON_SLUG);

    expect(risultato).toEqual({ creato: true, appuntamento_id: "appt-1" });
    expect(avviaPagamentoCaparraTenantFinto).not.toHaveBeenCalled();
    expect(creaAppuntamentoTenantFinto).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({ creatoDa: "ai" })
    );
  });
});

describe("eseguiStrumento -- crea_prenotazione con servizi consecutivi (più id in servizio_ids)", () => {
  const SERVIZIO_ID = "44444444-4444-4444-4444-444444444444";
  const SERVIZIO_ID_2 = "66666666-6666-6666-6666-666666666666";
  const OPERATORE_ID = "55555555-5555-5555-5555-555555555555";
  const INPUT_DUE_SERVIZI = {
    servizio_ids: [SERVIZIO_ID, SERVIZIO_ID_2],
    operatore_id: OPERATORE_ID,
    inizio: "2026-09-19T12:00",
    cliente_nome: "Mario Rossi",
    cliente_telefono: "3331234567",
  };
  const CTX_CON_SLUG: ContestoStrumento = {
    supabase: supabaseNonDovrebbeEssereChiamato,
    tenantId: TENANT_ID,
    slug: "salone-test",
    origin: "https://esempio.it",
  };

  beforeEach(() => {
    caricaImportoCaparraServizioFinto.mockReset();
    avviaPagamentoCaparraTenantFinto.mockReset();
    creaAppuntamentoTenantFinto.mockReset();
  });

  it("senza caparra, inoltra l'array servizio_ids intero (nell'ordine dato) a creaAppuntamentoTenant", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(0);
    creaAppuntamentoTenantFinto.mockResolvedValueOnce({ ok: true, appuntamentoId: "appt-1" });

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_DUE_SERVIZI, CTX_CON_SLUG);

    expect(risultato).toEqual({ creato: true, appuntamento_id: "appt-1" });
    // La caparra si calcola solo sul primo servizio della catena (limite noto,
    // vedi commento nel codice sorgente): verifica che sia proprio quell'id a
    // essere passato a caricaImportoCaparraServizio, non un array o l'ultimo.
    expect(caricaImportoCaparraServizioFinto).toHaveBeenCalledWith(expect.anything(), TENANT_ID, SERVIZIO_ID);
    expect(creaAppuntamentoTenantFinto).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({ servizioId: [SERVIZIO_ID, SERVIZIO_ID_2], creatoDa: "ai" })
    );
  });

  it("se l'attività richiede una caparra e il cliente vuole più servizi insieme, rifiuta con un errore esplicito invece di ignorare la caparra o prenotare un solo servizio", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(500); // 5,00€ sul primo servizio

    const risultato = await eseguiStrumento("crea_prenotazione", INPUT_DUE_SERVIZI, CTX_CON_SLUG);

    expect(risultato.errore).toBeDefined();
    expect(avviaPagamentoCaparraTenantFinto).not.toHaveBeenCalled();
    expect(creaAppuntamentoTenantFinto).not.toHaveBeenCalled();
  });

  it("un solo id in servizio_ids (caso normale) continua a funzionare come prima", async () => {
    caricaImportoCaparraServizioFinto.mockResolvedValueOnce(0);
    creaAppuntamentoTenantFinto.mockResolvedValueOnce({ ok: true, appuntamentoId: "appt-2" });

    const risultato = await eseguiStrumento(
      "crea_prenotazione",
      { ...INPUT_DUE_SERVIZI, servizio_ids: [SERVIZIO_ID] },
      CTX_CON_SLUG
    );

    expect(risultato).toEqual({ creato: true, appuntamento_id: "appt-2" });
    expect(creaAppuntamentoTenantFinto).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({ servizioId: [SERVIZIO_ID], creatoDa: "ai" })
    );
  });
});
