import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { generaBozzaOnboarding } from "@/lib/onboarding-ai.server";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import type { DiffConfigurazione } from "@/lib/onboarding-ai-diff";
import {
  aggiornaOperatore,
  aggiornaServizio,
  creaOperatore,
  creaServizio,
  eliminaOperatore,
  eliminaServizio,
  impostaAssociazioneOperatoreServizio,
  salvaOrari,
} from "./azioni";
import { aggiornaInformazioniAttivita, aggiungiFaq } from "../impostazioni/informazioni-attivita/azioni";
import { aggiornaFinestraCancellazione } from "../impostazioni/cancellazione/azioni";
import { applicaBozzaOnboarding, generaBozzaOnboardingAction } from "./onboarding-ai-azioni";

/**
 * Ogni dipendenza è mockata: questo file verifica SOLO l'orchestrazione
 * (quali azioni vengono chiamate, in che ordine, con quali guardie) -- non
 * la logica delle azioni granulari, già coperta dove vive, né il confronto
 * fra configurazione attuale e desiderata, che è puro e sta in
 * onboarding-ai-diff.test.ts, né l'estrazione AI vera
 * (onboarding-ai.server.test.ts).
 */
vi.mock("@/lib/supabase/server", () => ({ creaClientServer: vi.fn() }));
vi.mock("@/lib/supabase/tenant", () => ({
  ottieniTenantCorrente: vi.fn(),
  ottieniSessioneTenant: vi.fn(),
}));
vi.mock("@/lib/onboarding-ai.server", () => ({ generaBozzaOnboarding: vi.fn() }));
vi.mock("./azioni", () => ({
  salvaOrari: vi.fn().mockResolvedValue({ ok: true }),
  creaOperatore: vi.fn(),
  creaServizio: vi.fn(),
  aggiornaOperatore: vi.fn().mockResolvedValue({ ok: true }),
  aggiornaServizio: vi.fn().mockResolvedValue({ ok: true }),
  eliminaOperatore: vi.fn().mockResolvedValue({ ok: true }),
  eliminaServizio: vi.fn().mockResolvedValue({ ok: true }),
  impostaAssociazioneOperatoreServizio: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../impostazioni/informazioni-attivita/azioni", () => ({
  aggiornaInformazioniAttivita: vi.fn().mockResolvedValue({ ok: true }),
  aggiungiFaq: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../impostazioni/cancellazione/azioni", () => ({
  aggiornaFinestraCancellazione: vi.fn().mockResolvedValue({ ok: true }),
}));

const TENANT_ID = "tenant-1";

function bozzaVuota(): BozzaOnboarding {
  return {
    orari: Array.from({ length: 7 }, (_, giorno) => ({
      giornoSettimana: giorno,
      chiuso: true,
      apertura: null,
      chiusura: null,
      pausaInizio: null,
      pausaFine: null,
    })),
    operatori: [],
    servizi: [],
    associazioni: null,
    informazioniAttivita: null,
    faq: [],
    oreMinimeCancellazione: null,
  };
}

function diffVuoto(): DiffConfigurazione {
  return { operatori: [], servizi: [], associazioni: [], idSconosciuti: [] };
}

/**
 * Query finta: qualunque catena di select/eq/order/in risponde con lo stesso
 * dato, sia con await diretto sia con .single()/.maybeSingle(). Non
 * reimplementa il query builder -- serve solo a far arrivare una risposta
 * controllata a chi la aspetta.
 */
function query(risposta: unknown) {
  const q: Record<string, unknown> = {};
  const restituisci = () => q;
  const esito = { data: risposta, error: null };
  Object.assign(q, {
    select: restituisci,
    eq: restituisci,
    order: restituisci,
    in: restituisci,
    single: async () => esito,
    maybeSingle: async () => esito,
    then: (risolvi: (v: unknown) => unknown) => Promise.resolve(esito).then(risolvi),
  });
  return q;
}

function supabaseFinto(
  rigaTenant: Record<string, unknown> | null,
  tabelle: Record<string, unknown[]> = {}
) {
  return {
    from: vi.fn((tabella: string) =>
      query(tabella === "tenants" ? rigaTenant : (tabelle[tabella] ?? []))
    ),
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ottieniSessioneTenant).mockResolvedValue({
    userId: "utente-1",
    tenantId: TENANT_ID,
    ruolo: "owner",
    ruoloProfilo: "owner",
  });
});

describe("generaBozzaOnboardingAction", () => {
  it("passa il gate di piano corretto al modulo AI in base al piano del tenant", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "pro" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione di prova");

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", true, expect.anything());
  });

  it("il piano Free non abilita la knowledge base", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione di prova");

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", false, expect.anything());
  });

  it("MOSTRA AL MODELLO LA CONFIGURAZIONE CHE C'E' GIA'", async () => {
    // E' il pezzo che mancava: senza, dire "siamo in due" a un salone con
    // due operatori ne creava altri due (segnalato da Gabriel 18/09/2026).
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "free" }, {
        operatori: [{ id: "op-1", nome: "Anna", descrizione: null, attivo: true }],
        servizi: [{ id: "sv-1", nome: "Taglio", durata_minuti: 30, prezzo_centesimi: 2500, attivo: true }],
        operatori_servizi: [{ operatore_id: "op-1", servizio_id: "sv-1" }],
      })
    );
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Siamo in due");

    const statoPassato = vi.mocked(generaBozzaOnboarding).mock.calls[0][2];
    expect(statoPassato.operatori).toEqual([
      { id: "op-1", nome: "Anna", descrizione: null, attivo: true },
    ]);
    // I centesimi restano un dettaglio del database: fuori si ragiona in euro.
    expect(statoPassato.servizi[0].prezzoEuro).toBe(25);
    expect(statoPassato.associazioni).toEqual([{ operatoreId: "op-1", servizioId: "sv-1" }]);
  });

  it("restituisce anche il diff, calcolato dal codice e non dal modello", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "free" }, {
        operatori: [{ id: "op-1", nome: "Anna", descrizione: null, attivo: true }],
      })
    );
    const bozza = bozzaVuota();
    bozza.operatori = [{ id: "op-1", nome: "Anna", descrizione: null }];
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza });

    const esito = await generaBozzaOnboardingAction("Siamo in uno, Anna");

    expect(esito.ok).toBe(true);
    // Anna c'e' gia' ed e' identica: nessuna modifica proposta.
    expect(esito.ok && esito.diff.operatori).toEqual([]);
  });

  it("restituisce un errore gestito se non c'è un tenant associato, senza chiamare il modello", async () => {
    vi.mocked(ottieniSessioneTenant).mockResolvedValue(null);
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto(null));

    const risultato = await generaBozzaOnboardingAction("Test");

    expect(risultato.ok).toBe(false);
    expect(generaBozzaOnboarding).not.toHaveBeenCalled();
  });
});

describe("applicaBozzaOnboarding", () => {
  it("non tocca gli orari se la bozza non ne specifica nessuno aperto", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free", telefono: null }));

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diffVuoto());

    expect(salvaOrari).not.toHaveBeenCalled();
    expect(risultato.orariSalvati).toBe(false);
  });

  it("salva gli orari solo quando almeno un giorno è aperto", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.orari[1] = { giornoSettimana: 1, chiuso: false, apertura: "09:00", chiusura: "18:00", pausaInizio: null, pausaFine: null };

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(salvaOrari).toHaveBeenCalledTimes(1);
    const formInviato = vi.mocked(salvaOrari).mock.calls[0][0];
    expect(formInviato.get("apertura_1")).toBe("09:00");
    expect(formInviato.get("chiuso_0")).toBe("on"); // domenica, rimasta chiusa di default
    expect(risultato.orariSalvati).toBe(true);
  });

  it("crea operatori e servizi nuovi e li collega fra loro", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore).mockResolvedValue({ ok: true, id: "op-1" });
    vi.mocked(creaServizio).mockResolvedValue({ ok: true, id: "serv-1" });

    const diff = diffVuoto();
    diff.operatori = [{ tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Maria", descrizione: null } }];
    diff.servizi = [
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Manicure", durataMinuti: 30, prezzoEuro: 20 } },
    ];

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(creaOperatore).toHaveBeenCalledTimes(1);
    expect(creaServizio).toHaveBeenCalledTimes(1);
    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledWith("op-1", "serv-1", true);
    expect(risultato).toMatchObject({ operatoriCreati: 1, serviziCreati: 1, associazioniCreate: 1 });
  });

  it("il default tutti-con-tutti non sovrascrive quello che il diff dice esplicitamente", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore)
      .mockResolvedValueOnce({ ok: true, id: "op-maria" })
      .mockResolvedValueOnce({ ok: true, id: "op-luca" });
    vi.mocked(creaServizio).mockResolvedValue({ ok: true, id: "serv-manicure" });

    const diff = diffVuoto();
    diff.operatori = [
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Maria", descrizione: null } },
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Luca", descrizione: null } },
    ];
    diff.servizi = [
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Manicure", durataMinuti: 30, prezzoEuro: 20 } },
    ];
    // Solo Maria fa la manicure: Luca non deve essere collegato.
    diff.associazioni = [
      { tipo: "crea", operatoreId: null, servizioId: null, nomeOperatore: "Maria", nomeServizio: "Manicure" },
      { tipo: "rimuovi", operatoreId: null, servizioId: null, nomeOperatore: "Luca", nomeServizio: "Manicure" },
    ];

    await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledWith("op-maria", "serv-manicure", true);
    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledWith("op-luca", "serv-manicure", false);
    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledTimes(2);
  });

  it("aggiorna una riga esistente invece di ricrearla", async () => {
    // Ricrearla le farebbe perdere lo storico: gli appuntamenti passati
    // resterebbero senza operatore (on delete set null).
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));

    const diff = diffVuoto();
    diff.operatori = [
      {
        tipo: "aggiorna",
        id: "op-1",
        prima: { id: "op-1", nome: "Ana", descrizione: null, attivo: true },
        dopo: { id: "op-1", nome: "Anna", descrizione: null },
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(aggiornaOperatore).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aggiornaOperatore).mock.calls[0][0]).toBe("op-1");
    expect(creaOperatore).not.toHaveBeenCalled();
    expect(eliminaOperatore).not.toHaveBeenCalled();
    expect(risultato.operatoriAggiornati).toBe(1);
  });

  it("le rimozioni vengono eseguite DOPO creazioni e modifiche", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore).mockResolvedValue({ ok: true, id: "op-nuovo" });

    const ordine: string[] = [];
    vi.mocked(creaOperatore).mockImplementation(async () => {
      ordine.push("crea");
      return { ok: true, id: "op-nuovo" };
    });
    vi.mocked(eliminaOperatore).mockImplementation(async () => {
      ordine.push("elimina");
      return { ok: true };
    });

    const diff = diffVuoto();
    diff.operatori = [
      {
        tipo: "rimuovi",
        id: "op-vecchio",
        prima: { id: "op-vecchio", nome: "Luca", descrizione: null, attivo: true },
        dopo: null,
      },
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Maria", descrizione: null } },
    ];

    await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(ordine).toEqual(["crea", "elimina"]);
  });

  it("un rifiuto della cancellazione diventa un messaggio, non un fallimento silenzioso", async () => {
    // eliminaOperatore rifiuta chi ha appuntamenti collegati e suggerisce
    // la disattivazione: quel messaggio deve arrivare al titolare.
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(eliminaOperatore).mockResolvedValue({
      errore: "Ci sono 3 appuntamenti collegati a questo operatore. Disattivalo invece.",
    });

    const diff = diffVuoto();
    diff.operatori = [
      {
        tipo: "rimuovi",
        id: "op-1",
        prima: { id: "op-1", nome: "Luca", descrizione: null, attivo: true },
        dopo: null,
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(risultato.operatoriRimossi).toBe(0);
    expect(risultato.errori).toEqual(expect.arrayContaining([expect.stringMatching(/Luca.*Disattivalo/)]));
  });

  it("riporta un fallimento parziale (es. limite di piano) senza bloccare il resto", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore)
      .mockResolvedValueOnce({ ok: true, id: "op-1" })
      .mockResolvedValueOnce({ errore: "Il piano Free è limitato a 1 operatore." });

    const diff = diffVuoto();
    diff.operatori = [
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Maria", descrizione: null } },
      { tipo: "crea", id: null, prima: null, dopo: { id: null, nome: "Luca", descrizione: null } },
    ];

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(risultato.operatoriCreati).toBe(1);
    expect(risultato.errori).toEqual(expect.arrayContaining([expect.stringMatching(/Luca.*limitato a 1 operatore/)]));
  });

  it("mantiene descrizione/parcheggio già salvati quando la bozza fornisce solo l'indirizzo", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "pro", descrizione: "Salone accogliente", parcheggio: "Cortile interno", indirizzo: null, metodi_pagamento: null })
    );

    const bozza = bozzaVuota();
    bozza.informazioniAttivita = { descrizione: null, indirizzo: "Via Roma 1", parcheggio: null, metodiPagamento: null };

    await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiornaInformazioniAttivita).toHaveBeenCalledTimes(1);
    const formInviato = vi.mocked(aggiornaInformazioniAttivita).mock.calls[0][0];
    expect(formInviato.get("descrizione")).toBe("Salone accogliente");
    expect(formInviato.get("parcheggio")).toBe("Cortile interno");
    expect(formInviato.get("indirizzo")).toBe("Via Roma 1");
  });

  it("non chiama aggiornaInformazioniAttivita se il piano non ha la knowledge base, anche se la bozza propone dati", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.informazioniAttivita = { descrizione: "Test", indirizzo: null, parcheggio: null, metodiPagamento: null };

    await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiornaInformazioniAttivita).not.toHaveBeenCalled();
  });

  it("preserva il telefono esistente quando applica solo la finestra di cancellazione", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free", telefono: "3331234567" }));
    const bozza = bozzaVuota();
    bozza.oreMinimeCancellazione = 24;

    await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiornaFinestraCancellazione).toHaveBeenCalledTimes(1);
    const formInviato = vi.mocked(aggiornaFinestraCancellazione).mock.calls[0][0];
    expect(formInviato.get("telefono")).toBe("3331234567");
    expect(formInviato.get("ore_minime_cancellazione")).toBe("24");
  });

  it("crea una FAQ per ogni elemento della bozza, solo se il piano lo consente", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "enterprise" }));
    const bozza = bozzaVuota();
    bozza.faq = [
      { domanda: "Avete parcheggio?", risposta: "Sì." },
      { domanda: "Accettate carte?", risposta: "Sì." },
    ];

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiungiFaq).toHaveBeenCalledTimes(2);
    expect(risultato.faqCreate).toBe(2);
  });

  it("aggiorna un servizio esistente senza toccare i collegamenti", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));

    const diff = diffVuoto();
    diff.servizi = [
      {
        tipo: "aggiorna",
        id: "sv-1",
        prima: { id: "sv-1", nome: "Taglio", durataMinuti: 30, prezzoEuro: 25, attivo: true },
        dopo: { id: "sv-1", nome: "Taglio donna", durataMinuti: 30, prezzoEuro: 28 },
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozzaVuota(), diff);

    expect(aggiornaServizio).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aggiornaServizio).mock.calls[0][0]).toBe("sv-1");
    expect(impostaAssociazioneOperatoreServizio).not.toHaveBeenCalled();
    expect(risultato.serviziAggiornati).toBe(1);
  });
});
