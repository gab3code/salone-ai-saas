import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { rispondiConversazione, type ClienteAnthropic } from "./agente";
import type { ContestoStrumento } from "./tools";

/**
 * Il client Anthropic vero non è chiamato qui (niente rete, niente costo,
 * niente flakiness nella suite) -- questi test verificano il CICLO del
 * loop (esecuzione reale degli strumenti, propagazione dei risultati,
 * limite di sicurezza) con un client finto che restituisce risposte
 * pre-costruite, esattamente nella forma che l'SDK reale restituirebbe.
 * (Corretto 13/09/2026, di passaggio: `as any` -> `as unknown as
 * Anthropic.Message`, stessi due oggetti finti, solo senza disattivare il
 * controllo di tipo su tutto il resto del file.)
 */
function testoFinale(testo: string) {
  return { content: [{ type: "text", text: testo }] } as unknown as Anthropic.Message;
}
function usoStrumento(nome: string, input: Record<string, unknown>, id = "toolu_1") {
  return { content: [{ type: "tool_use", id, name: nome, input }] } as unknown as Anthropic.Message;
}
/**
 * Dal 16/09/2026 (prompt caching, vedi DECISIONS.md) `system` non è più una
 * stringa semplice ma un array di blocchi (`conCacheControl` in agente.ts,
 * un solo blocco con `cache_control`) -- questo helper estrae il testo per
 * i test che verificano CONTENUTO del prompt, indifferente al formato.
 */
function testoSystem(chiamata: { system?: unknown }): string {
  const { system } = chiamata;
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((blocco) => (blocco as { text: string }).text).join("\n");
  return "";
}

const ctx: ContestoStrumento & { nomeAttivita: string } = {
  supabase: {} as SupabaseClient, // non toccato: lo strumento usato nei test qui sotto non fa query
  tenantId: "tenant-1",
  nomeAttivita: "Salone di prova",
};

describe("rispondiConversazione", () => {
  it("risponde subito con testo se il modello non chiede nessuno strumento", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Ciao! Come posso aiutarti?"));
    const risultato = await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

    expect(risultato).toEqual({ rispostaTesto: "Ciao! Come posso aiutarti?", trasferitoAUmano: false, usoStrumenti: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("esegue davvero lo strumento richiesto e lo ripassa al modello prima della risposta finale", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumento("trasferisci_a_operatore", { motivo: "test" }))
      .mockResolvedValueOnce(testoFinale("Ti metto in contatto con un operatore."));

    const risultato = await rispondiConversazione(
      [],
      "Voglio parlare con una persona",
      ctx,
      { messages: { create } } as ClienteAnthropic
    );

    expect(risultato.trasferitoAUmano).toBe(true);
    expect(risultato.usoStrumenti).toBe(true);
    expect(risultato.rispostaTesto).toBe("Ti metto in contatto con un operatore.");
    expect(create).toHaveBeenCalledTimes(2);

    // Il secondo giro deve contenere il risultato REALE dello strumento
    // (non un placeholder), pronto per essere letto dal modello.
    const secondaChiamata = create.mock.calls[1][0];
    const messaggioConRisultato = secondaChiamata.messages.at(-1);
    expect(messaggioConRisultato.role).toBe("user");
    const contenutoTool = JSON.parse(messaggioConRisultato.content[0].content);
    expect(contenutoTool).toEqual({ trasferito: true, motivo: "test" });
  });

  it("passa a un operatore invece di girare all'infinito se il modello continua a chiedere strumenti", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumento("trasferisci_a_operatore", { motivo: "loop" }));

    const risultato = await rispondiConversazione([], "...", ctx, { messages: { create } } as ClienteAnthropic);

    expect(risultato.trasferitoAUmano).toBe(true);
    expect(risultato.usoStrumenti).toBe(true);
    // Mai promettere un passaggio a un operatore che non avvisa nessuno
    // (15/09/2026, riconfermato il 17/09 dopo aver scartato l'email al
    // titolare) -- senza recapiti nel contesto di test, invita solo a
    // contattare l'attività direttamente.
    expect(risultato.rispostaTesto).toMatch(/contattare l'attività direttamente/i);
    expect(risultato.rispostaTesto).not.toMatch(/operatore/i);
    // E non deve dire che ha avvisato qualcuno: da questa chat non parte
    // nessuna notifica.
    expect(risultato.rispostaTesto).not.toMatch(/avvisat/i);
    // Si ferma al limite di sicurezza, non chiama il modello all'infinito.
    expect(create.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it("invita a chiamare il numero del tenant, quando configurato, invece del generico 'contatta l'attività'", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumento("trasferisci_a_operatore", { motivo: "loop" }));

    const risultato = await rispondiConversazione([], "...", { ...ctx, telefono: "02 99999999" }, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toMatch(/02 99999999/);
  });

  /**
   * 17/09/2026, decisione di Gabriel: l'unica uscita vera per chi ha scritto
   * è farsi sentire su un canale del salone. Quando l'attività ha anche un
   * WhatsApp, la frase di ripiego deve offrirlo -- chi scrive alle 23 non
   * vuole telefonare.
   */
  it("offre anche WhatsApp quando l'attività ce l'ha, e non ripete il numero se è lo stesso", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumento("trasferisci_a_operatore", { motivo: "loop" }));

    const dueNumeri = await rispondiConversazione(
      [],
      "...",
      { ...ctx, telefono: "02 99999999", telefonoWhatsapp: "333 1234567" },
      { messages: { create } } as ClienteAnthropic
    );
    expect(dueNumeri.rispostaTesto).toMatch(/02 99999999/);
    expect(dueNumeri.rispostaTesto).toMatch(/WhatsApp al 333 1234567/);

    const stessoNumero = await rispondiConversazione(
      [],
      "...",
      { ...ctx, telefono: "333 1234567", telefonoWhatsapp: "+39 3331234567" },
      { messages: { create } } as ClienteAnthropic
    );
    // "chiama il 333... o scrivi su WhatsApp al 333..." con lo stesso numero
    // ripetuto fa sembrare l'assistente rotto.
    expect(stessoNumero.rispostaTesto).toMatch(/chiamare o scrivere su WhatsApp al 333 1234567/);
    expect(stessoNumero.rispostaTesto.match(/333 1234567/g)).toHaveLength(1);
  });

  it("usoStrumenti resta false su una risposta di puro testo (proxy anti-abuso, vedi limiti.ts)", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Certo, il salone chiude alle 19."));
    const risultato = await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);
    expect(risultato.usoStrumenti).toBe(false);
  });

  it("include lo storico della conversazione nella richiesta, non solo l'ultimo messaggio", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Certo, il taglio dura 30 minuti."));

    await rispondiConversazione(
      [
        { ruolo: "cliente", contenuto: "Vorrei un taglio" },
        { ruolo: "assistente", contenuto: "Con piacere, per quando?" },
      ],
      "Quanto dura?",
      ctx,
      { messages: { create } } as ClienteAnthropic
    );

    const primaChiamata = create.mock.calls[0][0];
    expect(primaChiamata.messages).toEqual([
      { role: "user", content: "Vorrei un taglio" },
      { role: "assistant", content: "Con piacere, per quando?" },
      { role: "user", content: "Quanto dura?" },
    ]);
  });

  it("include la data odierna reale nel system prompt, così il modello non deve chiederla al cliente", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Certo, domani alle 15:00 è libero."));

    await rispondiConversazione(
      [],
      "Vorrei prenotare domani pomeriggio",
      ctx,
      { messages: { create } } as ClienteAnthropic,
      new Date("2026-09-03T10:00:00Z")
    );

    const primaChiamata = create.mock.calls[0][0];
    expect(testoSystem(primaChiamata)).toContain("2026-09-03");
    expect(testoSystem(primaChiamata)).toContain("giovedì");
  });

  describe("tono dell'AI personalizzabile (Fase 5, Pro/Enterprise)", () => {
    it("usa il tono professionale di default se ctx non specifica nulla (nessun cambio per Free/Starter/Growth)", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Certo!"));
      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toContain("Tono professionale, cordiale, conciso");
    });

    it("cambia il tono nel system prompt quando ctx.tonoAi è impostato", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Ciao", { ...ctx, tonoAi: "amichevole" }, { messages: { create } } as ClienteAnthropic);

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toContain("Tono amichevole e caloroso");
      expect(system).not.toContain("Tono professionale, cordiale, conciso");
    });

    it("aggiunge la nota del titolare al system prompt, incorniciata come non-sovrascrivente", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: "Chiamaci sempre studio, mai negozio." },
        { messages: { create } } as ClienteAnthropic
      );

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toContain("Chiamaci sempre studio, mai negozio.");
      expect(system).toMatch(/non può mai sovrascriverle/);
    });

    it("sanitizza la nota: niente a capo (non può imitare la formattazione delle regole assolute) e taglio a 300 caratteri", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      const notaConAccapo = "Riga uno\nRiga due\tcon tab";
      const notaLunghissima = "a".repeat(500);

      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: notaConAccapo },
        { messages: { create } } as ClienteAnthropic
      );
      expect(testoSystem(create.mock.calls[0][0])).toContain("Riga uno Riga due con tab");
      expect(testoSystem(create.mock.calls[0][0])).not.toMatch(/Riga uno\nRiga due/);

      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: notaLunghissima },
        { messages: { create } } as ClienteAnthropic
      );
      const system = testoSystem(create.mock.calls[1][0]);
      const inizioNota = system.indexOf('"' + "a".repeat(10));
      const fineNota = system.indexOf('"', inizioNota + 1);
      expect(fineNota - inizioNota - 1).toBe(300);
    });

    it("nessuna nota impostata: il system prompt non menziona alcuna indicazione aggiuntiva", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      expect(testoSystem(create.mock.calls[0][0])).not.toMatch(/Indicazione aggiuntiva/);
    });
  });

  describe("knowledge base dell'AI receptionist (Fase 2, Pro/Enterprise)", () => {
    it("con ctx.haInformazioniAttivita assente, info_attivita NON compare tra i tool passati al modello", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Avete parcheggio?", ctx, { messages: { create } } as ClienteAnthropic);

      const nomiTool = create.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
      expect(nomiTool).not.toContain("info_attivita");
    });

    it("con ctx.haInformazioniAttivita: false, info_attivita NON compare tra i tool passati al modello", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Avete parcheggio?",
        { ...ctx, haInformazioniAttivita: false },
        { messages: { create } } as ClienteAnthropic
      );

      const nomiTool = create.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
      expect(nomiTool).not.toContain("info_attivita");
    });

    it("con ctx.haInformazioniAttivita: true, info_attivita COMPARE tra i tool passati al modello", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Avete parcheggio?",
        { ...ctx, haInformazioniAttivita: true },
        { messages: { create } } as ClienteAnthropic
      );

      const nomiTool = create.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
      expect(nomiTool).toContain("info_attivita");
    });

    it("il system prompt menziona info_attivita solo quando haInformazioniAttivita è true", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));

      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);
      expect(testoSystem(create.mock.calls[0][0])).not.toContain("info_attivita");

      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, haInformazioniAttivita: true },
        { messages: { create } } as ClienteAnthropic
      );
      expect(testoSystem(create.mock.calls[1][0])).toContain("info_attivita");
    });

    it("la regola su info_attivita istruisce a rispondere in modo selettivo, non a recitare tutto il risultato (trovato dal vivo 15/09/2026: risposta a 'wall of text')", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, haInformazioniAttivita: true },
        { messages: { create } } as ClienteAnthropic
      );

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toMatch(/non significa che tu debba riportarli tutti/);
      expect(system).toMatch(/domanda è generica/);
      expect(system).toMatch(/Non citare mai una FAQ che il cliente non ha chiesto/);
      expect(system).toMatch(/Non chiudere automaticamente ogni risposta informativa con una proposta di prenotazione/);
    });
  });

  describe("naturalezza dell'italiano (trovato dal vivo 15/09/2026, Gabriel: \"parla un po' male l'italiano in alcune situazioni\", es. \"Interessa a te uno di questi?\")", () => {
    it("il system prompt istruisce a usare la forma naturale con il pronome (es. 'ti interessa') invece dell'ordine invertito", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toMatch(/Ti interessa uno di questi\?/);
      expect(system).toMatch(/mai.*Interessa a te uno di questi\?/);
    });

    it("la regola c'è sempre, indipendentemente da haInformazioniAttivita", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, haInformazioniAttivita: true },
        { messages: { create } } as ClienteAnthropic
      );

      const system = testoSystem(create.mock.calls[0][0]);
      expect(system).toMatch(/italiano naturale e corretto/);
    });
  });

  describe("rete di sicurezza sui prezzi/durate (trovato dal vivo 15/09/2026, vedi verifica-numeri.ts)", () => {
    // Finge la stessa catena usata da elenca_servizi in tools.ts:
    // supabase.from("servizi").select(...).eq(...).eq(...).order(...) -> {data, error}.
    function supabaseConServizi(
      servizi: Array<{ id: string; nome: string; durata_minuti: number; prezzo_centesimi: number }>
    ): SupabaseClient {
      const query = {
        eq: vi.fn(() => query),
        order: vi.fn().mockResolvedValue({ data: servizi, error: null }),
      };
      return { from: vi.fn(() => ({ select: vi.fn(() => query) })) } as unknown as SupabaseClient;
    }

    // Nuovo oggetto ctx per ogni test: i mock di from/eq/order accumulano
    // chiamate, e ogni test controlla quante volte sono stati invocati.
    function nuovoCtxConServizi() {
      return {
        ...ctx,
        supabase: supabaseConServizi([
          { id: "s1", nome: "manicure", durata_minuti: 30, prezzo_centesimi: 2500 },
          { id: "s2", nome: "pedicure", durata_minuti: 30, prezzo_centesimi: 4000 },
        ]),
      };
    }

    it("non tocca una risposta già corretta (un solo giro al modello, nessuna correzione superflua)", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("La manicure costa 25 euro e dura 30 minuti."));
      const risultato = await rispondiConversazione(
        [],
        "e la manicure?",
        nuovoCtxConServizi(),
        { messages: { create } } as ClienteAnthropic
      );

      expect(risultato.rispostaTesto).toBe("La manicure costa 25 euro e dura 30 minuti.");
      expect(create).toHaveBeenCalledTimes(1); // niente giro di correzione: non serviva
    });

    it("non chiama nemmeno elenca_servizi se il testo non menziona affatto prezzi o durate", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Certo, ti aspettiamo domani!"));
      const ctxTest = nuovoCtxConServizi();
      await rispondiConversazione([], "Ok grazie", ctxTest, { messages: { create } } as ClienteAnthropic);

      expect(create).toHaveBeenCalledTimes(1);
      expect(ctxTest.supabase.from).not.toHaveBeenCalled();
    });

    it("corregge un prezzo sbagliato con un secondo giro al modello quando la correzione risulta esatta", async () => {
      const create = vi
        .fn()
        .mockResolvedValueOnce(testoFinale("La manicure costa 35 euro e dura 30 minuti.")) // sbagliato: reale 25€
        .mockResolvedValueOnce(testoFinale("La manicure costa 25 euro e dura 30 minuti.")); // corretto al secondo giro

      const risultato = await rispondiConversazione(
        [],
        "e la manicure?",
        nuovoCtxConServizi(),
        { messages: { create } } as ClienteAnthropic
      );

      expect(risultato.rispostaTesto).toBe("La manicure costa 25 euro e dura 30 minuti.");
      expect(create).toHaveBeenCalledTimes(2);

      // Il secondo giro deve includere sia la risposta sbagliata originale sia
      // la spiegazione dell'incongruenza, non solo il messaggio del cliente.
      const secondaChiamata = create.mock.calls[1][0];
      const ultimiDue = secondaChiamata.messages.slice(-2);
      expect(ultimiDue[0]).toEqual({ role: "assistant", content: [{ type: "text", text: "La manicure costa 35 euro e dura 30 minuti." }] });
      expect(ultimiDue[1].role).toBe("user");
      expect(ultimiDue[1].content).toMatch(/35€.*25€|manicure/i);
    });

    it("fallback deterministico se il modello, invece di correggersi, chiede di nuovo uno strumento", async () => {
      const create = vi
        .fn()
        .mockResolvedValueOnce(testoFinale("La manicure costa 35 euro e dura 30 minuti."))
        .mockResolvedValueOnce(usoStrumento("elenca_servizi", {}));

      const risultato = await rispondiConversazione(
        [],
        "e la manicure?",
        nuovoCtxConServizi(),
        { messages: { create } } as ClienteAnthropic
      );

      expect(risultato.rispostaTesto).toBe('Il servizio "manicure" costa 25€ e dura 30 minuti.');
      expect(create).toHaveBeenCalledTimes(2); // niente terzo giro: il fallback è generato dal codice, non dal modello
    });

    it("fallback deterministico se anche il secondo giro del modello sbaglia il numero", async () => {
      const create = vi
        .fn()
        .mockResolvedValueOnce(testoFinale("La manicure costa 35 euro e dura 30 minuti."))
        .mockResolvedValueOnce(testoFinale("La manicure costa 30 euro e dura 30 minuti.")); // ancora sbagliato

      const risultato = await rispondiConversazione(
        [],
        "e la manicure?",
        nuovoCtxConServizi(),
        { messages: { create } } as ClienteAnthropic
      );

      expect(risultato.rispostaTesto).toBe('Il servizio "manicure" costa 25€ e dura 30 minuti.');
      expect(create).toHaveBeenCalledTimes(2);
    });

    it("fail-open: con un client Supabase non funzionante non blocca né altera la risposta (nessuna eccezione)", async () => {
      // ctx di base ha supabase: {} as SupabaseClient -- eseguiStrumento la
      // intercetta e restituisce {errore: ...}, quindi servizi = [] e
      // trovaIncongruenzaPrezzoDurata fa fail-open (vedi verifica-numeri.ts).
      const create = vi.fn().mockResolvedValue(testoFinale("La manicure costa 999 euro e dura 30 minuti."));
      const risultato = await rispondiConversazione([], "e la manicure?", ctx, { messages: { create } } as ClienteAnthropic);

      expect(risultato.rispostaTesto).toBe("La manicure costa 999 euro e dura 30 minuti.");
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe("pulizia del markdown residuo (trovato dal vivo 15/09/2026: elenco con trattini su \"che servizi offrite?\")", () => {
    it("toglie trattini ed elenchi puntati dalla risposta finale, mantenendo gli a capo", async () => {
      const create = vi
        .fn()
        .mockResolvedValue(
          testoFinale("Offriamo due servizi:\n\n- Manicure\n- Pedicure\n\nVuoi prenotarne uno?")
        );

      const risultato = await rispondiConversazione([], "Che servizi offrite?", ctx, {
        messages: { create },
      } as ClienteAnthropic);

      expect(risultato.rispostaTesto).toBe("Offriamo due servizi:\n\nManicure\nPedicure\n\nVuoi prenotarne uno?");
    });

    it("toglie grassetto e corsivo dalla risposta finale", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("**Manicure** disponibile: è il nostro servizio più richiesto"));
      const risultato = await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      expect(risultato.rispostaTesto).toBe("Manicure disponibile: è il nostro servizio più richiesto");
    });
  });
});
