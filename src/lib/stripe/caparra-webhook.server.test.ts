import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { completaPagamentoCaparra } from "./caparra-webhook.server";

/**
 * Il webhook della caparra, rigiocato nei casi in cui prima rimborsava un
 * cliente che aveva il posto (vedi l'intestazione del modulo).
 *
 * `creaAppuntamento` e' iniettata: qui non si testa il motore di
 * prenotazione (ha i suoi test), si testa cosa fa il webhook con il suo
 * esito. Il client Supabase finto risponde in ordine FIFO per tabella: ogni
 * scenario dichiara la sequenza delle letture che il codice fara'.
 */

const RICHIESTA = {
  id: "rich-1",
  tenant_id: "tenant-1",
  servizio_id: "serv-1",
  operatore_id: "op-1",
  inizio_iso: "2026-09-23T16:00",
  cliente_nome: "Marco Rossi",
  cliente_telefono: "3331234567",
  cliente_email: null,
  importo_centesimi: 800,
  stripe_checkout_session_id: "cs_1",
  stato: "in_attesa",
};

function sessione(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_1",
    payment_status: "paid",
    payment_intent: "pi_1",
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function stripeFinto() {
  const create = vi.fn().mockResolvedValue({ id: "re_1" });
  return { stripe: { refunds: { create } } as unknown as Pick<Stripe, "refunds">, rimborso: create };
}

const CREA_OK = vi.fn().mockResolvedValue({ ok: true, appuntamentoId: "app-1" });
const CREA_CONFLITTO = vi.fn().mockResolvedValue({
  ok: false,
  errore: "Questo orario non è più disponibile: è stato appena prenotato da qualcun altro.",
});

describe("completaPagamentoCaparra", () => {
  it("caso normale: crea l'appuntamento con la caparra nella INSERT, chiude la richiesta, nessun rimborso", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: { select: [{ data: RICHIESTA }], update: [{ data: null, error: null }] },
      appuntamenti: { select: [{ data: null }] }, // nessun appuntamento con questo intent
    });
    const { stripe, rimborso } = stripeFinto();
    const crea = vi.fn().mockResolvedValue({ ok: true, appuntamentoId: "app-1" });

    const esito = await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: crea });

    expect(esito).toEqual({ ok: true });
    expect(crea).toHaveBeenCalledTimes(1);
    expect(crea.mock.calls[0][2].caparra).toEqual({ importoCentesimi: 800, stripePaymentIntentId: "pi_1" });
    expect(rimborso).not.toHaveBeenCalled();
    expect(admin.registro.update).toEqual([
      {
        tabella: "richieste_caparra",
        payload: { stato: "completata", stripe_payment_intent_id: "pi_1", appuntamento_id: "app-1" },
      },
    ]);
  });

  /**
   * IL DIFETTO 1. Due consegne dello stesso evento corrono insieme: la
   * seconda va in conflitto perche' la prima ha appena creato l'appuntamento.
   * Prima: rimborso e "fallita_conflitto" sopra una prenotazione riuscita.
   */
  it("consegna concorrente: il conflitto e' l'altro worker, quindi NIENTE rimborso", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: { select: [{ data: RICHIESTA }], update: [{ data: null, error: null }] },
      appuntamenti: {
        select: [
          { data: null }, // prima della creazione: ancora niente
          { data: { id: "app-dell-altro" } }, // dopo il conflitto: l'altro worker ha finito
        ],
      },
    });
    const { stripe, rimborso } = stripeFinto();

    const esito = await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: CREA_CONFLITTO });

    expect(esito).toEqual({ ok: true });
    expect(rimborso).not.toHaveBeenCalled();
    expect(admin.registro.update[0].payload).toMatchObject({ stato: "completata", appuntamento_id: "app-dell-altro" });
  });

  it("conflitto VERO (slot preso da un altro cliente): rimborso e fallita_conflitto", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: { select: [{ data: RICHIESTA }], update: [{ data: null, error: null }] },
      appuntamenti: { select: [{ data: null }, { data: null }] },
    });
    const { stripe, rimborso } = stripeFinto();

    const esito = await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: CREA_CONFLITTO });

    expect(esito).toEqual({ ok: true });
    expect(rimborso).toHaveBeenCalledWith({ payment_intent: "pi_1" });
    expect(admin.registro.update[0].payload).toMatchObject({ stato: "fallita_conflitto" });
  });

  /**
   * IL DIFETTO 2. Appuntamento creato, poi la scrittura di "completata"
   * fallisce. Prima: 200 a Stripe, richiesta "in attesa" per sempre.
   */
  it("scrittura fallita dopo la creazione: torna un errore (la route rispondera' 500)", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: {
        select: [{ data: RICHIESTA }],
        update: [{ data: null, error: { message: "connessione persa" } }],
      },
      appuntamenti: { select: [{ data: null }] },
    });
    const { stripe } = stripeFinto();

    const esito = await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: CREA_OK });

    expect(esito).toEqual({ errore: "richieste_caparra (rich-1): connessione persa" });
  });

  it("...e al tentativo successivo ritrova l'appuntamento dall'intent, chiude e non crea niente", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: { select: [{ data: RICHIESTA }], update: [{ data: null, error: null }] },
      appuntamenti: { select: [{ data: { id: "app-1" } }] },
    });
    const { stripe, rimborso } = stripeFinto();
    const crea = vi.fn();

    const esito = await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: crea });

    expect(esito).toEqual({ ok: true });
    expect(crea).not.toHaveBeenCalled();
    expect(rimborso).not.toHaveBeenCalled();
    expect(admin.registro.update[0].payload).toMatchObject({ stato: "completata", appuntamento_id: "app-1" });
  });

  it("richiesta gia' chiusa: non fa niente", async () => {
    const admin = creaSupabaseFinto({
      richieste_caparra: { select: [{ data: { ...RICHIESTA, stato: "completata" } }] },
    });
    const { stripe, rimborso } = stripeFinto();
    const crea = vi.fn();

    expect(await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: crea })).toEqual({ ok: true });
    expect(crea).not.toHaveBeenCalled();
    expect(rimborso).not.toHaveBeenCalled();
    expect(admin.registro.update).toEqual([]);
  });

  it("pagamento non ancora incassato (metodo differito): lascia la richiesta in attesa", async () => {
    const admin = creaSupabaseFinto({ richieste_caparra: { select: [{ data: RICHIESTA }] } });
    const { stripe } = stripeFinto();
    const crea = vi.fn();

    expect(
      await completaPagamentoCaparra(admin, stripe, sessione({ payment_status: "unpaid" }), { creaAppuntamento: crea })
    ).toEqual({ ok: true });
    expect(crea).not.toHaveBeenCalled();
    expect(admin.registro.update).toEqual([]);
  });

  it("sessione sconosciuta: nessun errore da ritentare", async () => {
    const admin = creaSupabaseFinto({ richieste_caparra: { select: [{ data: null }] } });
    const { stripe } = stripeFinto();
    expect(await completaPagamentoCaparra(admin, stripe, sessione(), { creaAppuntamento: vi.fn() })).toEqual({ ok: true });
  });
});
