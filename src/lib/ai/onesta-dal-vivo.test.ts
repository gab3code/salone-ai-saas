import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { rispondiConversazione, type ClienteAnthropic } from "./agente";
import { preparaOrariPerIlModello } from "./proposta-orari";
import type { ContestoStrumento, NomeStrumento } from "./tools";

/**
 * Le tre bugie vere dell'assistente, rigiocate una per una.
 *
 * ----------------------------------------------------------------------
 * PERCHE' ESISTE QUESTO FILE, e perche' non e' quello che avrei voluto fare.
 *
 * Il 19/09/2026 Gabriel ha chiesto: "provala tu stesso prima di farmi fare il
 * push". Giusto: fino a quel momento ogni modifica all'assistente era stata
 * verificata solo contro un modello finto che rispondeva quello che ci
 * faceva comodo, e intanto il prodotto vero diceva a un cliente che aveva
 * prenotato senza aver prenotato niente.
 *
 * Ho provato a parlarci davvero. Non si puo' da qui: il database non e'
 * raggiungibile dalla macchina, e la chiamata ad api.anthropic.com viene
 * rifiutata dal proxy dell'ambiente. Quindi questa NON e' una conversazione
 * col modello vero, e non va spacciata per tale.
 *
 * Quello che e' vero e' tutto il resto: il modello finto qui sotto non dice
 * cose comode, dice **parola per parola quello che il modello vero ha detto
 * a Gabriel** nelle tre conversazioni del 18 e 19 settembre. I dati degli
 * strumenti sono quelli veri del suo salone di prova, passati per le stesse
 * funzioni della produzione. Quello che si verifica e' l'unica cosa che
 * possiamo verificare senza rete: **che quelle frasi, oggi, non arrivino piu'
 * al cliente.**
 *
 * Un test con una risposta inventata da me avrebbe dimostrato solo che so
 * scrivere test. Queste frasi le ha scritte il modello.
 */

function testoFinale(testo: string) {
  return { content: [{ type: "text", text: testo }], stop_reason: "end_turn" } as unknown as Anthropic.Message;
}
function usoStrumento(nome: string, input: Record<string, unknown>, id = "toolu_1") {
  return {
    content: [{ type: "tool_use", id, name: nome, input }],
    stop_reason: "tool_use",
  } as unknown as Anthropic.Message;
}

/** Gli orari veri di martedi' 22/09: 08:00-11:30 e 14:00-17:30, passo 15. */
function slotVeri() {
  const slot: { inizio: string; operatoreId: string }[] = [];
  const aggiungi = (da: number, a: number) => {
    for (let m = da; m <= a; m += 15) {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slot.push({ inizio: `2026-09-22T${h}:${mm}:00.000Z`, operatoreId: "op" });
    }
  };
  aggiungi(8 * 60, 11 * 60 + 30);
  aggiungi(14 * 60, 17 * 60 + 30);
  return slot;
}

const RISULTATO_DISPONIBILITA = {
  ...preparaOrariPerIlModello(slotVeri()),
  slot: slotVeri().map((s) => ({ inizio: s.inizio, operatore_id: s.operatoreId })),
  giorno_chiuso: false,
  giorno_settimana_richiesto: "martedi'",
};

function contesto(esegui?: (n: NomeStrumento, i: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  return {
    supabase: {} as SupabaseClient,
    tenantId: "tenant-1",
    nomeAttivita: "prova gabriel",
    telefono: "02 99999999",
    esegui: esegui as never,
  } as ContestoStrumento & { nomeAttivita: string; telefono: string };
}

describe("le bugie vere dell'assistente, rigiocate", () => {
  it("BUGIA 1 -- 'ti ho prenotato la pedicure, la prenotazione e' confermata' senza aver prenotato", async () => {
    // Detta a Gabriel il 19/09/2026 alle 00:00:42. Nel database: niente.
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        testoFinale(
          "Grazie! Ti ho prenotato la pedicure per lunedì 21 settembre alle 08:00.\n\nLa prenotazione è confermata."
        )
      )
      // Rimandato a verificare, il modello insiste invece di chiamare lo strumento.
      .mockResolvedValueOnce(testoFinale("Sì, la prenotazione è confermata!"))
      .mockResolvedValueOnce(testoFinale("Sì, la prenotazione è confermata!"));

    const risultato = await rispondiConversazione([], "Gabriel 3314823757", contesto(), {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).not.toMatch(/confermat/i);
    expect(risultato.rispostaTesto).not.toMatch(/ho prenotato/i);
    expect(risultato.rispostaTesto).toMatch(/non risulta nessun appuntamento/i);
    // Il recapito vero, perche' il cliente deve poter fare qualcosa.
    expect(risultato.rispostaTesto).toContain("02 99999999");
  });

  it("BUGIA 2 -- la lista di orari inventata, pausa pranzo compresa", async () => {
    // Detta il 19/09 alle 00:00:19 circa: 12:00 e 13:00 sono in pausa.
    let chiamatoStrumento = false;
    const esegui = async (nome: NomeStrumento) => {
      if (nome === "verifica_disponibilita") {
        chiamatoStrumento = true;
        return RISULTATO_DISPONIBILITA as unknown as Record<string, unknown>;
      }
      return {};
    };

    const create = vi
      .fn()
      .mockResolvedValueOnce(
        testoFinale(
          "Gli orari disponibili martedì 22 settembre per la manicure sono:\n\n8:00, 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00"
        )
      )
      // Rimandato a verificare, stavolta lo strumento lo chiama.
      .mockResolvedValueOnce(usoStrumento("verifica_disponibilita", { servizio_ids: ["s1"], data: "2026-09-22" }))
      .mockResolvedValueOnce(
        testoFinale("Martedì 22 settembre ho libero:\nMattina: 08:00, 08:15\nPomeriggio: 14:00, 14:15")
      );

    const risultato = await rispondiConversazione([], "dimmi tutti gli orari", contesto(esegui), {
      messages: { create },
    } as ClienteAnthropic);

    // Il rientro nel loop ha funzionato: lo strumento e' stato eseguito DAVVERO.
    expect(chiamatoStrumento).toBe(true);
    // La pausa pranzo non compare piu'.
    expect(risultato.rispostaTesto).not.toContain("12:00");
    expect(risultato.rispostaTesto).not.toContain("13:00");
    // E gli orari che compaiono sono quelli veri.
    expect(risultato.rispostaTesto).toContain("08:00");
    expect(risultato.rispostaTesto).toContain("14:00");
  });

  it("BUGIA 3 -- 'riceverai una mail di conferma' a chi non ha lasciato nessuna mail", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        testoFinale("Se hai bisogno di modificarla, troverai il link nella mail di conferma che riceverai tra poco.")
      )
      .mockResolvedValueOnce(testoFinale("Ti aspetto martedì. Ti arriverà comunque una mail di conferma."))
      .mockResolvedValueOnce(testoFinale("Ti aspetto martedì. Ti arriverà comunque una mail di conferma."));

    const risultato = await rispondiConversazione([], "ok", contesto(), {
      messages: { create },
    } as ClienteAnthropic);

    // La frase sulla mail sparisce, il resto del messaggio resta.
    expect(risultato.rispostaTesto).not.toMatch(/mail/i);
    expect(risultato.rispostaTesto).toContain("Ti aspetto martedì");
  });

  it("IL CONTRARIO -- una risposta onesta non viene toccata", async () => {
    // Meta' del valore di queste reti sta qui: una che scatta anche sulle
    // risposte buone viene spenta dopo due giorni.
    const esegui = async (nome: NomeStrumento) =>
      nome === "verifica_disponibilita"
        ? (RISULTATO_DISPONIBILITA as unknown as Record<string, unknown>)
        : {};

    const onesta =
      "Martedì 22 settembre ho libero:\nMattina: 08:00, 08:15, 08:30\nPomeriggio: 14:00, 14:15\nIn tutto sono 30 orari. Quale preferisci?";

    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumento("verifica_disponibilita", { servizio_ids: ["s1"], data: "2026-09-22" }))
      .mockResolvedValueOnce(testoFinale(onesta));

    const risultato = await rispondiConversazione([], "che orari hai martedì?", contesto(esegui), {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toBe(onesta);
    expect(create).toHaveBeenCalledTimes(2); // nessun giro di correzione sprecato
  });

  it("IL CONTRARIO 2 -- ripetere un orario che il CLIENTE ha appena scritto e' legittimo", async () => {
    const create = vi.fn().mockResolvedValueOnce(testoFinale("Perfetto, ti aspetto martedì alle 09:30."));

    const risultato = await rispondiConversazione(
      [{ ruolo: "cliente", contenuto: "posso alle 09:30?" }],
      "sì alle 09:30",
      contesto(),
      { messages: { create } } as ClienteAnthropic
    );

    expect(risultato.rispostaTesto).toBe("Perfetto, ti aspetto martedì alle 09:30.");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("BUGIA 4 -- 'riceverai una conferma via SMS', e nessun SMS parte mai", async () => {
    // Detta il 19/09 alle 01:04. Il controllo copriva solo la parola "mail":
    // il modello ha trovato il buco da solo cambiando canale.
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        testoFinale("Prenotazione confermata per martedì alle 8:00. Riceverai una conferma via SMS. A presto!")
      )
      .mockResolvedValueOnce(testoFinale("Ti arriva un SMS di conferma."))
      .mockResolvedValueOnce(testoFinale("Ti arriva un SMS di conferma."));

    const risultato = await rispondiConversazione([], "Gabriel 3314823757", contesto(), {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).not.toMatch(/sms/i);
  });

  it("BUGIA 5 -- 'siamo chiusi oggi' senza aver guardato gli orari", async () => {
    // Detta il 19/09: il salone quel sabato era aperto dalle 07:00 alle
    // 12:00. E' il danno piu' silenzioso: un cliente mandato via non lascia
    // traccia da nessuna parte.
    let haGuardato = false;
    const esegui = async (nome: NomeStrumento) => {
      if (nome === "verifica_disponibilita") {
        haGuardato = true;
        return RISULTATO_DISPONIBILITA as unknown as Record<string, unknown>;
      }
      return {};
    };

    const create = vi
      .fn()
      .mockResolvedValueOnce(testoFinale("Oggi è sabato 19 settembre, ma siamo chiusi oggi."))
      .mockResolvedValueOnce(usoStrumento("verifica_disponibilita", { servizio_ids: ["s1"], data: "2026-09-22" }))
      .mockResolvedValueOnce(testoFinale("Oggi ho libero:\nMattina: 08:00, 08:15"));

    const risultato = await rispondiConversazione([], "oggi invece?", contesto(esegui), {
      messages: { create },
    } as ClienteAnthropic);

    expect(haGuardato).toBe(true);
    expect(risultato.rispostaTesto).not.toMatch(/chius/i);
    expect(risultato.rispostaTesto).toContain("08:00");
  });

  it("IL CONTRARIO 3 -- 'siamo chiusi' DOPO aver guardato passa intatto", async () => {
    const esegui = async () =>
      ({ slot: [], tutti_gli_orari_liberi: [], quanti_in_tutto: 0, giorno_chiuso: true }) as unknown as Record<
        string,
        unknown
      >;

    const onesta = "Domenica siamo chiusi. Ti va bene lunedì?";
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumento("verifica_disponibilita", { servizio_ids: ["s1"], data: "2026-09-20" }))
      .mockResolvedValueOnce(testoFinale(onesta));

    const risultato = await rispondiConversazione([], "domenica?", contesto(esegui), {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).toBe(onesta);
  });

  it("una risposta TRONCATA dal limite di token non arriva al cliente a meta'", async () => {
    const create = vi.fn().mockResolvedValueOnce({
      content: [{ type: "text", text: "Martedì ho libero alle 08:00, alle 08:15, alle 0" }],
      stop_reason: "max_tokens",
    } as unknown as Anthropic.Message);

    const risultato = await rispondiConversazione([], "che orari hai?", contesto(), {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.rispostaTesto).not.toContain("alle 0\u0000");
    expect(risultato.rispostaTesto).toMatch(/non sono riuscito a completare/i);
    expect(risultato.rispostaTesto).toContain("02 99999999");
  });
});
