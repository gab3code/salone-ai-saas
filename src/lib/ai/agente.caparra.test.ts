import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { rispondiConversazione, type ClienteAnthropic } from "./agente";
import type { ContestoStrumento, NomeStrumento } from "./tools";

/**
 * Rete di sicurezza sull'importo della caparra dichiarato dall'AI (trovato
 * dal vivo il 15/09/2026, vedi DECISIONS.md e verifica-numeri.ts: l'AI ha
 * scritto "25 euro" al cliente quando l'importo vero restituito da
 * crea_prenotazione era 5). File separato da agente.test.ts perché qui
 * serve un mock mirato di eseguiStrumento (per far restituire a
 * crea_prenotazione un risultato di caparra fisso senza passare dal vero
 * Stripe/DB) -- vi.mock è a livello di modulo e non deve toccare i mock
 * delle altre suite.
 */
const IMPORTO_CAPARRA_REALE = 5;
const URL_PAGAMENTO_FINTO = "https://checkout.stripe.com/c/pay/cs_test_finto";

vi.mock("./tools", async (importOriginal) => {
  const reale = await importOriginal<typeof import("./tools")>();
  return {
    ...reale,
    eseguiStrumento: vi.fn(async (nome: NomeStrumento, input: Record<string, unknown>, ctx: ContestoStrumento) => {
      if (nome === "crea_prenotazione") {
        return {
          richiede_pagamento: true,
          url_pagamento: URL_PAGAMENTO_FINTO,
          importo_caparra_euro: IMPORTO_CAPARRA_REALE,
        };
      }
      return reale.eseguiStrumento(nome, input, ctx);
    }),
  };
});

function testoFinale(testo: string) {
  return { content: [{ type: "text", text: testo }] } as unknown as Anthropic.Message;
}
function usoStrumentoCreaPrenotazione(id = "toolu_1") {
  return {
    content: [
      {
        type: "tool_use",
        id,
        name: "crea_prenotazione",
        input: {
          servizio_id: "11111111-1111-1111-1111-111111111111",
          operatore_id: "22222222-2222-2222-2222-222222222222",
          inizio: "2026-09-19T10:00",
          cliente_nome: "Mario Rossi",
          cliente_telefono: "3210000000",
        },
      },
    ],
  } as unknown as Anthropic.Message;
}
function usoStrumento(nome: string, input: Record<string, unknown>, id = "toolu_2") {
  return { content: [{ type: "tool_use", id, name: nome, input }] } as unknown as Anthropic.Message;
}

const ctx: ContestoStrumento & { nomeAttivita: string } = {
  supabase: {} as SupabaseClient, // non toccato per crea_prenotazione: intercettato dal mock sopra
  tenantId: "tenant-1",
  nomeAttivita: "Salone di prova",
  slug: "salone-di-prova",
  origin: "https://esempio.test",
};

describe("rete di sicurezza sull'importo della caparra (trovato dal vivo 15/09/2026)", () => {
  it("non tocca una risposta che già cita l'importo corretto (nessun giro di correzione superfluo)", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumentoCreaPrenotazione())
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 5 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      );

    const risultato = await rispondiConversazione([], "Prenota per sabato alle 10", ctx, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toContain("5 euro");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("corregge un importo di caparra sbagliato con un secondo giro al modello quando la correzione risulta esatta", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumentoCreaPrenotazione())
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 25 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      )
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 5 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      );

    const risultato = await rispondiConversazione([], "Prenota per sabato alle 10", ctx, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toContain("5 euro");
    expect(risultato.rispostaTesto).not.toContain("25 euro");
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("fallback deterministico se anche il secondo giro del modello sbaglia l'importo: sostituisce solo il numero, preservando il link di pagamento", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumentoCreaPrenotazione())
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 25 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      )
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 30 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      ); // ancora sbagliato

    const risultato = await rispondiConversazione([], "Prenota per sabato alle 10", ctx, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toContain("5 euro");
    expect(risultato.rispostaTesto).not.toContain("30 euro");
    expect(risultato.rispostaTesto).toContain(URL_PAGAMENTO_FINTO);
    expect(create).toHaveBeenCalledTimes(3); // niente terzo giro: il fallback è generato dal codice
  });

  it("fallback deterministico se il modello, invece di correggersi, chiede di nuovo uno strumento", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumentoCreaPrenotazione())
      .mockResolvedValueOnce(
        testoFinale(`Questa attività richiede una caparra di 25 euro per confermare, ecco il link: ${URL_PAGAMENTO_FINTO}`)
      )
      .mockResolvedValueOnce(usoStrumento("elenca_servizi", {}));

    const risultato = await rispondiConversazione([], "Prenota per sabato alle 10", ctx, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toContain("5 euro");
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("non scatta nessun controllo se questo turno non ha mai chiamato crea_prenotazione", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Ciao! Come posso aiutarti?"));
    const risultato = await rispondiConversazione([], "Ciao", ctx, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toBe("Ciao! Come posso aiutarti?");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
