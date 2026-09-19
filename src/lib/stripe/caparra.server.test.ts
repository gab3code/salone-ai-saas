import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { pseudoUtcAReale } from "@/lib/fuso-orario";

// Isola dalla sincronizzazione calendari esterni (stesso principio di
// booking-engine.server.test.ts): "nessun calendario esterno collegato" come
// default, non rilevante per questi test sulla logica di pagamento caparra.
vi.mock("@/lib/calendario-esterno/collegamenti.server", () => ({
  caricaImpegniEsterni: vi.fn().mockResolvedValue([]),
}));

import { caricaImportoCaparraServizio, avviaPagamentoCaparraTenant } from "./caparra.server";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const SERVIZIO_ID = "22222222-2222-2222-2222-222222222222";
const OPERATORE_ID = "33333333-3333-3333-3333-333333333333";

const rispostaTenantFuso = { data: { fuso_orario: "Europe/Rome" }, error: null };

function creaStripeFinto(sessionUrl: string | null = "https://checkout.stripe.com/sess_test_123") {
  const create = vi.fn().mockResolvedValue({ id: "cs_test_123", url: sessionUrl });
  return { checkout: { sessions: { create } } } as unknown as Stripe;
}

vi.mock("@/lib/clienti.server", () => ({
  trovaClientePerTelefono: vi.fn(async (_t: string, telefono: string) => (telefono === "3330000000" ? null : { id: "cliente-1" })),
}));

describe("caricaImportoCaparraServizio -- caparra selettiva (0071)", () => {
  const TENANT_SELETTIVO = {
    caparra_attiva: true,
    caparra_tipo: "fisso",
    caparra_valore: 1500,
    caparra_regola: "dopo_no_show",
    caparra_no_show_soglia: 1,
  };

  it("chi ha gia' saltato paga, chi non ha assenze no, un telefono mai visto no", async () => {
    const conAssenza = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_SELETTIVO, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
      appuntamenti: { select: [{ data: null, count: 1, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(conAssenza, TENANT_ID, SERVIZIO_ID, "3331234567")).toBe(1500);

    const senzaAssenze = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_SELETTIVO, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
      appuntamenti: { select: [{ data: null, count: 0, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(senzaAssenze, TENANT_ID, SERVIZIO_ID, "3331234567")).toBe(0);

    const maiVisto = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_SELETTIVO, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(maiVisto, TENANT_ID, SERVIZIO_ID, "3330000000")).toBe(0);
  });

  it("se il conteggio dei no-show fallisce torna null: non si decide alla cieca", async () => {
    const rotto = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_SELETTIVO, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
      appuntamenti: { select: [{ data: null, count: null, error: { message: "boom" } }] },
    });
    expect(await caricaImportoCaparraServizio(rotto, TENANT_ID, SERVIZIO_ID, "3331234567")).toBeNull();
  });
});

describe("caricaImportoCaparraServizio", () => {
  it("torna l'importo se la caparra è attiva", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { caparra_attiva: true, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(supabase, TENANT_ID, SERVIZIO_ID)).toBe(1000);
  });

  it("torna 0 se la caparra non è attiva", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { caparra_attiva: false, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(supabase, TENANT_ID, SERVIZIO_ID)).toBe(0);
  });

  it("torna null -- non 0 -- se non si riesce a leggere la configurazione", async () => {
    // La differenza vale soldi (audit del 17/09/2026): 0 per il chiamante
    // vuol dire "nessuna caparra richiesta", quindi un errore transitorio del
    // database faceva prenotare senza deposito su un salone che invece lo
    // chiede. Chi chiama deve poter distinguere "non e' dovuta" da "non lo
    // so", e fermarsi nel secondo caso.
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: null, error: null }] },
      servizi: { select: [{ data: null, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(supabase, TENANT_ID, SERVIZIO_ID)).toBeNull();
  });

  it("zero resta zero quando la risposta e' certa: la caparra non e' attiva", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { caparra_attiva: false, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }] },
      servizi: { select: [{ data: { prezzo_centesimi: 5000 }, error: null }] },
    });
    expect(await caricaImportoCaparraServizio(supabase, TENANT_ID, SERVIZIO_ID)).toBe(0);
  });
});

describe("avviaPagamentoCaparraTenant", () => {
  const paramsBase = {
    tenantId: TENANT_ID,
    slug: "salone-test",
    origin: "https://esempio.it",
    servizioId: SERVIZIO_ID,
    operatoreId: OPERATORE_ID,
    inizio: new Date(Date.UTC(2026, 8, 19, 10, 0, 0)),
    inizioIso: "2026-09-19T12:00",
    clienteTelefono: "3331234567",
  };

  it("crea la Checkout Session e la riga richieste_caparra, ritorna l'url", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [{ data: { nome: "Salone Test", caparra_attiva: true, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }, rispostaTenantFuso],
      },
      servizi: { select: [{ data: { nome: "Manicure", prezzo_centesimi: 2500, durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
      richieste_caparra: { insert: [{ data: null, error: null }] },
    });
    const stripe = creaStripeFinto();

    const risultato = await avviaPagamentoCaparraTenant(supabase, { ...paramsBase, clienteNome: "Mario Rossi" }, stripe);

    expect(risultato).toEqual({ ok: true, checkoutUrl: "https://checkout.stripe.com/sess_test_123", importoCentesimi: 500 });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        success_url: "https://esempio.it/s/salone-test?caparra=successo#prenota",
        cancel_url: "https://esempio.it/s/salone-test?caparra=annullata#prenota",
        metadata: { tipo: "caparra", tenant_id: TENANT_ID },
      })
    );
  });

  it("senza nome cliente usa il fallback 'Cliente', mai un dato mancante nella riga inserita", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [{ data: { nome: "Salone Test", caparra_attiva: true, caparra_tipo: "fisso", caparra_valore: 1000 }, error: null }, rispostaTenantFuso],
      },
      servizi: { select: [{ data: { nome: "Manicure", prezzo_centesimi: 2500, durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
      richieste_caparra: { insert: [{ data: null, error: null }] },
    });
    const stripe = creaStripeFinto();

    const risultato = await avviaPagamentoCaparraTenant(supabase, paramsBase, stripe);

    expect(risultato.ok).toBe(true);
    expect(supabase.registro.insert[0]).toEqual({
      tabella: "richieste_caparra",
      payload: expect.objectContaining({ cliente_nome: "Cliente" }),
    });
  });

  it("nessuna caparra richiesta (importo 0): errore esplicito, MAI una Checkout Session a importo zero", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { nome: "Salone Test", caparra_attiva: false, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }] },
      servizi: { select: [{ data: { nome: "Manicure", prezzo_centesimi: 2500, durata_minuti: 30 }, error: null }] },
    });
    const stripe = creaStripeFinto();

    const risultato = await avviaPagamentoCaparraTenant(supabase, paramsBase, stripe);

    expect(risultato.ok).toBe(false);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("slot già occupato dall'operatore: errore esplicito, MAI far pagare per uno slot che non esiste più", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [{ data: { nome: "Salone Test", caparra_attiva: true, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }, rispostaTenantFuso],
      },
      servizi: { select: [{ data: { nome: "Manicure", prezzo_centesimi: 2500, durata_minuti: 30 }, error: null }] },
      appuntamenti: {
        select: [
          {
            data: [
              {
                id: "altro-appuntamento",
                operatore_id: OPERATORE_ID,
                // Righe DB in UTC "reale": stessa conversione pseudo-UTC ->
                // reale usata da verificaConflittoTenant per confrontare,
                // altrimenti (fuso Europe/Rome, +2h in settembre) questo
                // appuntamento non risulterebbe mai in conflitto con
                // paramsBase.inizio (pseudo-UTC).
                inizio: pseudoUtcAReale(paramsBase.inizio, "Europe/Rome").toISOString(),
                fine: pseudoUtcAReale(new Date(paramsBase.inizio.getTime() + 30 * 60_000), "Europe/Rome").toISOString(),
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });
    const stripe = creaStripeFinto();

    const risultato = await avviaPagamentoCaparraTenant(supabase, paramsBase, stripe);

    expect(risultato).toEqual({ ok: false, errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot." });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("tenant o servizio non trovati: errore esplicito", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: null, error: null }] },
      servizi: { select: [{ data: null, error: null }] },
    });
    const stripe = creaStripeFinto();

    const risultato = await avviaPagamentoCaparraTenant(supabase, paramsBase, stripe);
    expect(risultato.ok).toBe(false);
  });

  it("Stripe non ritorna un url: errore esplicito, mai un checkoutUrl vuoto/undefined restituito come se fosse ok", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [{ data: { nome: "Salone Test", caparra_attiva: true, caparra_tipo: "percentuale", caparra_valore: 20 }, error: null }, rispostaTenantFuso],
      },
      servizi: { select: [{ data: { nome: "Manicure", prezzo_centesimi: 2500, durata_minuti: 30 }, error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });
    const stripe = creaStripeFinto(null);

    const risultato = await avviaPagamentoCaparraTenant(supabase, paramsBase, stripe);
    expect(risultato).toEqual({ ok: false, errore: "Stripe non ha restituito un URL di pagamento." });
  });
});
