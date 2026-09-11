import { describe, it, expect, vi, beforeEach } from "vitest";
import { creaSupabaseFinto, type ChiamataScrittura } from "@/test/supabase-finto";
import {
  parsaOrarioLocale,
  caricaContestoBooking,
  verificaConflittoTenant,
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
} from "./booking-engine.server";
import type { AppuntamentoEsistente } from "./booking-engine";

// Isola questo livello dalla sincronizzazione calendari esterni (Fase 6bis):
// quella ha già i suoi test (ics.test.ts) e le sue chiamate di rete vere --
// qui vogliamo verificare SOLO la logica di booking-engine.server.ts, con
// "nessun calendario esterno collegato" come caso di default (coerente con
// il comportamento fail-open reale). I test su verificaConflittoTenant e
// caricaContestoBooking sotto sovrascrivono il valore quando serve
// verificare che un impegno esterno venga davvero fuso con quelli interni.
vi.mock("@/lib/calendario-esterno/collegamenti.server", () => ({
  caricaImpegniEsterni: vi.fn(),
}));
import { caricaImpegniEsterni } from "@/lib/calendario-esterno/collegamenti.server";

const caricaImpegniEsterniFinto = vi.mocked(caricaImpegniEsterni);

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const OPERATORE_ID = "operatore-1";
const SERVIZIO_ID = "servizio-1";
const FUSO = "Europe/Rome";

// Luglio (CEST, UTC+2) per una conversione fissa e verificabile a mano:
// 16:00 civile Roma <-> 14:00 UTC reale. Usato in tutti i test scrittura per
// controllare che la conversione fuso orario applicata PRIMA di scrivere su
// Postgres sia quella giusta -- è esattamente il bug risolto l'11/09/2026
// (problema noto #1), quindi merita copertura diretta qui, non solo sul
// modulo puro fuso-orario.test.ts.
const INIZIO_PSEUDO = new Date(Date.UTC(2026, 6, 15, 16, 0, 0)); // 2026-07-15T16:00 civile
const INIZIO_REALE_ISO = "2026-07-15T14:00:00.000Z";
const FINE_REALE_ISO = "2026-07-15T14:30:00.000Z"; // servizio da 30 minuti

function rispostaTenantPiano(piano: string) {
  return { data: { piano }, error: null };
}
function rispostaTenantFuso(fuso = FUSO) {
  return { data: { fuso_orario: fuso }, error: null };
}

beforeEach(() => {
  caricaImpegniEsterniFinto.mockReset();
  caricaImpegniEsterniFinto.mockResolvedValue([]);
});

describe("parsaOrarioLocale", () => {
  it("accetta 'YYYY-MM-DDTHH:MM' senza fuso esplicito, trattato come pseudo-UTC", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("accetta i secondi espliciti", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:30");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:30.000Z");
  });

  it("accetta un fuso esplicito 'Z'", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00Z");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("accetta un offset esplicito e lo converte", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00+02:00");
    expect(d?.toISOString()).toBe("2026-09-05T13:00:00.000Z");
  });

  it("rifiuta una stringa che non è una data, mai un valore a caso", () => {
    expect(parsaOrarioLocale("non-una-data")).toBeNull();
  });

  it("rifiuta una data senza orario (formato incompleto)", () => {
    expect(parsaOrarioLocale("2026-09-05")).toBeNull();
  });

  it("rifiuta un'ora fuori range anche se il formato sembra giusto (25:00 non esiste)", () => {
    // Il parser di V8 è lassista su `new Date(stringaLibera)` ma rigoroso sul
    // formato ISO esteso con fuso esplicito -- qui verifichiamo che la nostra
    // validazione non lasci passare un valore così silenziosamente.
    expect(parsaOrarioLocale("2026-09-05T25:00")).toBeNull();
  });
});

describe("caricaContestoBooking", () => {
  it("mappa orari/chiusure/operatori/servizi e converte gli appuntamenti da reale a pseudo-UTC", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: {
        select: [
          {
            data: [
              {
                giorno_settimana: 1,
                chiuso: false,
                apertura: "09:00:00",
                chiusura: "19:00:00",
                pausa_inizio: null,
                pausa_fine: null,
              },
            ],
            error: null,
          },
        ],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [{ id: OPERATORE_ID, attivo: true }], error: null }] },
      operatori_servizi: {
        select: [{ data: [{ operatore_id: OPERATORE_ID, servizio_id: SERVIZIO_ID }], error: null }],
      },
      appuntamenti: {
        select: [
          {
            data: [
              {
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });

    const contesto = await caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO);

    expect(contesto.orari).toEqual([
      {
        giornoSettimana: 1,
        chiuso: false,
        apertura: "09:00",
        chiusura: "19:00",
        pausaInizio: undefined,
        pausaFine: undefined,
      },
    ]);
    expect(contesto.operatori).toEqual([{ id: OPERATORE_ID, attivo: true, servizioIds: [SERVIZIO_ID] }]);
    // L'appuntamento è tornato dal DB in tempo reale (14:00 UTC) -- deve
    // essere convertito a pseudo-UTC (16:00, l'ora civile del salone) prima
    // di arrivare al motore puro.
    expect(contesto.appuntamenti).toHaveLength(1);
    expect(contesto.appuntamenti[0].inizio.toISOString()).toBe("2026-07-15T16:00:00.000Z");
    expect(contesto.appuntamenti[0].fine.toISOString()).toBe("2026-07-15T16:30:00.000Z");
  });

  it("fonde gli impegni dei calendari esterni collegati con gli appuntamenti interni", async () => {
    const impegnoEsterno: AppuntamentoEsistente = {
      operatoreId: OPERATORE_ID,
      inizio: new Date(Date.UTC(2026, 6, 15, 18, 0, 0)),
      fine: new Date(Date.UTC(2026, 6, 15, 18, 30, 0)),
      stato: "confermato",
    };
    caricaImpegniEsterniFinto.mockResolvedValue([impegnoEsterno]);

    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: { select: [{ data: [], error: null }] },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });

    const contesto = await caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO);

    expect(contesto.appuntamenti).toEqual([impegnoEsterno]);
  });

  it("lancia un errore leggibile se una query fallisce, mai un dato a metà", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: { select: [{ data: null, error: { message: "connessione persa" } }] },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });

    await expect(caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO)).rejects.toThrow(
      /orari.*connessione persa/
    );
  });
});

describe("verificaConflittoTenant", () => {
  it("nessuna riga, nessun impegno esterno -> nessun conflitto", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(false);
  });

  it("una riga confermata nello stesso slot dello stesso operatore -> conflitto", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: {
        select: [
          {
            data: [
              {
                id: "altro-appuntamento",
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(true);
  });

  it("esclude l'appuntamento che si sta modificando (ignoraAppuntamentoId), non risulta in conflitto con se stesso", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: {
        select: [
          {
            data: [
              {
                id: "appuntamento-in-modifica",
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
      ignoraAppuntamentoId: "appuntamento-in-modifica",
    });
    expect(conflitto).toBe(false);
  });

  it("un impegno su un calendario esterno collegato blocca lo slot come un appuntamento interno", async () => {
    caricaImpegniEsterniFinto.mockResolvedValue([
      { operatoreId: OPERATORE_ID, inizio: INIZIO_PSEUDO, fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000), stato: "confermato" },
    ]);
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(true);
  });
});

describe("creaAppuntamentoTenant", () => {
  it("blocca la creazione se il piano Free ha raggiunto il tetto mensile di prenotazioni", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("free")] },
      appuntamenti: { select: [{ data: null, error: null, count: 60 }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/piano Free/);
  });

  it("non blocca un piano diverso da Free anche con molte prenotazioni (nessun tetto per gli altri piani)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "nuovo-appuntamento" }, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(true);
  });

  it("restituisce un errore esplicito se il servizio non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth")] },
      servizi: { select: [{ data: null, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: false, errore: "Servizio non trovato." });
  });

  it("blocca la creazione se l'operatore ha già un appuntamento in quello slot", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: {
        select: [
          {
            data: [
              { id: "x", operatore_id: OPERATORE_ID, inizio: INIZIO_REALE_ISO, fine: FINE_REALE_ISO, stato: "confermato" },
            ],
            error: null,
          },
        ],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/già un appuntamento/);
  });

  it("scrive l'istante REALE corretto (convertito dal fuso del tenant), non l'orario pseudo-UTC grezzo", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: {
        select: [{ data: [], error: null }],
        insert: [{ data: { id: "nuovo-appuntamento" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: true, appuntamentoId: "nuovo-appuntamento" });
    expect(supabase.registro.insert).toHaveLength(1);
    const scrittura = supabase.registro.insert[0] as { tabella: string; payload: Record<string, unknown> };
    expect(scrittura.tabella).toBe("appuntamenti");
    expect(scrittura.payload.inizio).toBe(INIZIO_REALE_ISO);
    expect(scrittura.payload.fine).toBe(FINE_REALE_ISO);
  });

  it("trova un cliente esistente per telefono invece di duplicarlo", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "app-1" }, error: null }] },
      clienti: { select: [{ data: { id: "cliente-esistente" }, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3331234567",
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(true);
    expect(supabase.registro.insert.some((c: ChiamataScrittura) => c.tabella === "clienti")).toBe(false);
    const scritturaAppuntamento = supabase.registro.insert.find(
      (c: ChiamataScrittura) => c.tabella === "appuntamenti"
    ) as { payload: Record<string, unknown> };
    expect(scritturaAppuntamento.payload.cliente_id).toBe("cliente-esistente");
  });

  it("crea un cliente nuovo se il telefono non corrisponde a nessuno già registrato", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "app-1" }, error: null }] },
      clienti: {
        select: [{ data: null, error: null }],
        insert: [{ data: { id: "cliente-nuovo" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3339999999",
      clienteNome: "Cliente Test",
      creatoDa: "ai",
    });
    expect(risultato.ok).toBe(true);
    const scritturaCliente = supabase.registro.insert.find(
      (c: ChiamataScrittura) => c.tabella === "clienti"
    ) as { payload: Record<string, unknown> };
    expect(scritturaCliente.payload).toMatchObject({
      tenant_id: TENANT_ID,
      nome: "Cliente Test",
      telefono: "3339999999",
      creato_da_ai: true,
    });
  });

  it("traduce il vincolo Postgres 23P01 (race condition sfuggita al controllo applicativo) in un messaggio chiaro", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      appuntamenti: {
        select: [{ data: [], error: null }],
        insert: [{ data: null, error: { message: "conflitto", code: "23P01" } }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({
      ok: false,
      errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
    });
  });
});

describe("modificaAppuntamentoTenant", () => {
  const APPUNTAMENTO_ID = "appuntamento-1";

  it("restituisce un errore esplicito se l'appuntamento non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { select: [{ data: null, error: null }] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({ ok: false, errore: "Appuntamento non trovato." });
  });

  it("sposta l'appuntamento scrivendo l'istante reale corretto", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null }, // appuntamento attuale
          { data: [], error: null }, // righe per il controllo conflitti (nessuna)
        ],
        update: [{ data: null, error: null }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({ ok: true });
    expect(supabase.registro.update).toHaveLength(1);
    const scrittura = supabase.registro.update[0] as { tabella: string; payload: Record<string, unknown> };
    expect(scrittura.tabella).toBe("appuntamenti");
    expect(scrittura.payload.inizio).toBe(INIZIO_REALE_ISO);
    expect(scrittura.payload.fine).toBe(FINE_REALE_ISO);
  });

  it("blocca lo spostamento se il nuovo slot è in conflitto con un altro appuntamento", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null },
          {
            data: [
              { id: "altro", operatore_id: OPERATORE_ID, inizio: INIZIO_REALE_ISO, fine: FINE_REALE_ISO, stato: "confermato" },
            ],
            error: null,
          },
        ],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      tenants: { select: [rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/già un appuntamento/);
  });

  it("traduce il vincolo Postgres 23P01 in un messaggio chiaro anche per lo spostamento", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null },
          { data: [], error: null },
        ],
        update: [{ data: null, error: { message: "conflitto", code: "23P01" } }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({
      ok: false,
      errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
    });
  });
});

describe("cancellaAppuntamentoTenant", () => {
  it("restituisce un errore esplicito se l'appuntamento non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: [], error: null }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "non-esiste");
    expect(risultato).toEqual({ ok: false, errore: "Appuntamento non trovato." });
  });

  it("cancella (soft-delete a stato 'cancellato') un appuntamento esistente", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: [{ id: "appuntamento-1" }], error: null }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
    expect(risultato).toEqual({ ok: true });
    expect(supabase.registro.update[0]).toMatchObject({ tabella: "appuntamenti", payload: { stato: "cancellato" } });
  });

  it("propaga un errore del database come messaggio leggibile", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: null, error: { message: "timeout" } }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
    expect(risultato).toEqual({ ok: false, errore: "Errore cancellando l'appuntamento: timeout" });
  });
});
