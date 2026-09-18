import { describe, expect, it } from "vitest";
import { ripulisciEvento, ripulisciTesto, ripulisciUrl, SOSTITUTO } from "./sentry-riservatezza";

describe("ripulisciTesto", () => {
  it("toglie le email", () => {
    expect(ripulisciTesto("errore per anna.rossi@gmail.com")).toBe(`errore per ${SOSTITUTO}`);
  });

  it("toglie i numeri di telefono, comunque scritti", () => {
    expect(ripulisciTesto("chiama il 3331234567")).toBe(`chiama il ${SOSTITUTO}`);
    expect(ripulisciTesto("+39 333 123 4567 non risponde")).toBe(`${SOSTITUTO} non risponde`);
  });

  it("NON tocca i numeri che servono a capire l'errore", () => {
    // Se questo test sparisse, gli errori resterebbero riservati e inutili.
    expect(ripulisciTesto("errore 500 alle 14:30, durata 50 min")).toBe("errore 500 alle 14:30, durata 50 min");
    expect(ripulisciTesto("prezzo 4500 centesimi")).toBe("prezzo 4500 centesimi");
  });

  it("lascia intatto un testo senza dati di nessuno", () => {
    expect(ripulisciTesto("slot non disponibile")).toBe("slot non disponibile");
  });
});

describe("ripulisciUrl", () => {
  it("toglie il termine di ricerca, che e' il nome di un cliente", () => {
    expect(ripulisciUrl("https://salone.it/dashboard/clienti?q=Anna%20Rossi")).toBe(
      `https://salone.it/dashboard/clienti?q=${SOSTITUTO}`
    );
  });

  it("tiene gli id: senza, un errore non si rincorre", () => {
    const url = "https://salone.it/dashboard/calendario?data=2026-09-21&servizio_id=abc-123";
    expect(ripulisciUrl(url)).toBe(url);
  });

  it("tiene il percorso anche quando toglie tutto il resto", () => {
    expect(ripulisciUrl("https://salone.it/dashboard/clienti?q=Anna&telefono=3331234567")).toBe(
      `https://salone.it/dashboard/clienti?q=${SOSTITUTO}&telefono=${SOSTITUTO}`
    );
  });

  it("un indirizzo senza parametri resta com'e'", () => {
    expect(ripulisciUrl("https://salone.it/dashboard")).toBe("https://salone.it/dashboard");
  });
});

describe("ripulisciEvento", () => {
  it("butta via intestazioni, cookie e corpo della richiesta", () => {
    // Il cookie di sessione di Supabase e' un token valido: in un sistema di
    // terzi e' una chiave di casa lasciata sullo zerbino.
    const evento = ripulisciEvento({
      request: {
        url: "https://salone.it/dashboard/clienti?q=Anna",
        headers: { cookie: "sb-access-token=eyJhbGciOi..." },
        cookies: { "sb-access-token": "eyJhbGciOi..." },
        data: { cliente_nome: "Anna Rossi", cliente_telefono: "3331234567" },
      },
      user: { id: "utente-1", email: "anna@gmail.com" },
    });

    expect(evento.request?.headers).toBeUndefined();
    expect(evento.request?.cookies).toBeUndefined();
    expect(evento.request?.data).toBeUndefined();
    expect(evento.user).toBeUndefined();
    expect(evento.request?.url).toBe(`https://salone.it/dashboard/clienti?q=${SOSTITUTO}`);
  });

  it("ripulisce il messaggio dell'eccezione, non solo l'indirizzo", () => {
    // Il caso vero: un errore del database che si porta dietro la riga.
    const evento = ripulisciEvento({
      exception: {
        values: [{ value: 'duplicate key value violates unique constraint: telefono "3331234567"' }],
      },
    });

    expect(evento.exception?.values?.[0].value).toBe(
      `duplicate key value violates unique constraint: telefono "${SOSTITUTO}"`
    );
  });

  it("ripulisce anche le briciole di navigazione", () => {
    const evento = ripulisciEvento({
      breadcrumbs: [
        { data: { from: "/dashboard/clienti?q=Anna", to: "/dashboard/clienti/abc?telefono=3331234567" } },
        { message: "cercato mario.bianchi@libero.it" },
      ],
    });

    expect(evento.breadcrumbs?.[0].data?.from).toBe(`/dashboard/clienti?q=${SOSTITUTO}`);
    expect(evento.breadcrumbs?.[0].data?.to).toBe(`/dashboard/clienti/abc?telefono=${SOSTITUTO}`);
    expect(evento.breadcrumbs?.[1].message).toBe(`cercato ${SOSTITUTO}`);
  });

  it("un evento gia' pulito passa senza essere rovinato", () => {
    const evento = ripulisciEvento({
      request: { url: "https://salone.it/dashboard/calendario?data=2026-09-21" },
      exception: { values: [{ value: "Cannot read properties of undefined" }] },
    });

    expect(evento.request?.url).toBe("https://salone.it/dashboard/calendario?data=2026-09-21");
    expect(evento.exception?.values?.[0].value).toBe("Cannot read properties of undefined");
  });
});
