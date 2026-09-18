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
  impostaAssociazioneOperatoreServizio,
  salvaOrari,
  salvaRegoleAgenda,
  salvaOrariOperatore,
  aggiungiChiusura,
} from "./azioni";
import { aggiornaContatti } from "../impostazioni/contatti/azioni";
import { aggiungiRegolaPromemoria } from "../impostazioni/promemoria/azioni";
import { aggiornaCaparra } from "../impostazioni/caparra/azioni";
import { aggiornaInformazioniAttivita, aggiungiFaq } from "../impostazioni/informazioni-attivita/azioni";
import { aggiornaFinestraCancellazione } from "../impostazioni/cancellazione/azioni";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";
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
// La quota si consuma con il client admin, che qui non esiste: il consumo ha
// i suoi test altrove, qui interessa che venga chiamato e che un tetto
// raggiunto fermi la chiamata al modello.
vi.mock("@/lib/ai/usi-interni.server", () => ({
  consumaUsoAiInterno: vi.fn().mockResolvedValue({ ok: true, rimasti: 14 }),
  contaUsiAiInterniQuestoMese: vi.fn().mockResolvedValue(0),
}));
vi.mock("./azioni", () => ({
  salvaOrari: vi.fn().mockResolvedValue({ ok: true }),
  creaOperatore: vi.fn(),
  creaServizio: vi.fn(),
  aggiornaOperatore: vi.fn().mockResolvedValue({ ok: true }),
  aggiornaServizio: vi.fn().mockResolvedValue({ ok: true }),
  eliminaOperatore: vi.fn().mockResolvedValue({ ok: true }),
  eliminaServizio: vi.fn().mockResolvedValue({ ok: true }),
  impostaAssociazioneOperatoreServizio: vi.fn().mockResolvedValue({ ok: true }),
  salvaRegoleAgenda: vi.fn().mockResolvedValue({ ok: true }),
  salvaOrariOperatore: vi.fn().mockResolvedValue({ ok: true }),
  aggiungiChiusura: vi.fn().mockResolvedValue({ ok: true, giorni: 1 }),
  eliminaChiusura: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../impostazioni/contatti/azioni", () => ({
  aggiornaContatti: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../impostazioni/promemoria/azioni", () => ({
  aggiungiRegolaPromemoria: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../impostazioni/caparra/azioni", () => ({
  aggiornaCaparra: vi.fn().mockResolvedValue({ ok: true }),
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
    regoleAgenda: null,
    orariOperatore: [],
    contatti: null,
    promemoria: null,
    caparra: null,
    chiusure: [],
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

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", true, expect.anything(), expect.anything());
  });

  it("il piano Free non abilita la knowledge base", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione di prova");

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", false, expect.anything(), expect.anything());
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

  it("consuma la quota PRIMA di chiamare il modello", async () => {
    // Fino al 18/09/2026 questa era l'unica strada del prodotto che chiamava
    // Anthropic senza contatore, senza tetto e senza gate di piano.
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione");

    // Su un piano senza quota AI il tetto e' a vita, non mensile: tre
    // configurazioni assistite in tutto (decisione 18/09/2026).
    expect(consumaUsoAiInterno).toHaveBeenCalledWith(TENANT_ID, "onboarding", {
      limite: 3,
      daSempre: true,
    });
  });

  it("su un piano con quota AI la bozza consuma quella, al mese", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "growth" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione");

    expect(consumaUsoAiInterno).toHaveBeenCalledWith(TENANT_ID, "onboarding", {
      limite: 2500,
      daSempre: false,
    });
  });

  it("quando le configurazioni assistite finiscono, il messaggio dice cosa fare", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(consumaUsoAiInterno).mockResolvedValueOnce({ ok: false, motivo: "tetto_raggiunto" });

    const risultato = await generaBozzaOnboardingAction("Descrizione");

    expect(risultato.ok).toBe(false);
    // Un tetto raggiunto e' il momento in cui la persona sta decidendo:
    // il messaggio deve dire cosa puo' fare adesso, non solo di no.
    expect(!risultato.ok && risultato.errore).toContain("a mano");
    expect(!risultato.ok && risultato.errore).toContain("Growth");
    expect(!risultato.ok && risultato.esaurite).toBe(true);
  });

  it("con il tetto raggiunto NON chiama il modello", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(consumaUsoAiInterno).mockResolvedValueOnce({ ok: false, motivo: "tetto_raggiunto" });

    const risultato = await generaBozzaOnboardingAction("Descrizione");

    expect(risultato.ok).toBe(false);
    expect(generaBozzaOnboarding).not.toHaveBeenCalled();
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

  it("le regole d'agenda non azzerano quello che la bozza non nomina", async () => {
    // salvaRegoleAgenda scrive i tre campi insieme: dire solo "10 minuti fra
    // un cliente e l'altro" non deve far perdere un passo gia' scelto.
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "free", passo_slot_minuti: 30, buffer_minuti: 0, riempimento_agenda: "attaccato" })
    );
    const bozza = bozzaVuota();
    bozza.regoleAgenda = { passoMinuti: null, bufferMinuti: 10, modalitaRiempimento: null };

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    const fd = vi.mocked(salvaRegoleAgenda).mock.calls[0][0];
    expect(fd.get("buffer_minuti")).toBe("10");
    expect(fd.get("passo_slot_minuti")).toBe("30");
    expect(fd.get("riempimento_agenda")).toBe("attaccato");
    expect(risultato.regoleAgendaSalvate).toBe(true);
  });

  it("gli orari di una persona finiscono sull'operatore giusto", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "free" }, { operatori: [{ id: "op-rita", nome: "Rita" }] })
    );
    const bozza = bozzaVuota();
    bozza.orariOperatore = [
      {
        operatore: "rita",
        orari: [
          { giornoSettimana: 2, chiuso: false, apertura: "09:00", chiusura: "13:00", pausaInizio: null, pausaFine: null },
          ...[0, 1, 3, 4, 5, 6].map((g) => ({
            giornoSettimana: g,
            chiuso: true,
            apertura: null,
            chiusura: null,
            pausaInizio: null,
            pausaFine: null,
          })),
        ],
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(salvaOrariOperatore).toHaveBeenCalledTimes(1);
    // Il nome si risolve senza badare a maiuscole e spazi.
    expect(vi.mocked(salvaOrariOperatore).mock.calls[0][0]).toBe("op-rita");
    const fd = vi.mocked(salvaOrariOperatore).mock.calls[0][1];
    expect(fd.get("op_apertura_2")).toBe("09:00");
    expect(fd.get("op_chiuso_0")).toBe("on");
    expect(risultato.orariOperatoreSalvati).toBe(1);
  });

  it("una persona che non esiste diventa un messaggio, non un salvataggio a caso", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }, { operatori: [] }));
    const bozza = bozzaVuota();
    bozza.orariOperatore = [
      {
        operatore: "Fantasma",
        orari: [
          { giornoSettimana: 1, chiuso: false, apertura: "09:00", chiusura: "13:00", pausaInizio: null, pausaFine: null },
        ],
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(salvaOrariOperatore).not.toHaveBeenCalled();
    expect(risultato.errori).toEqual(expect.arrayContaining([expect.stringMatching(/Fantasma/)]));
  });

  it("i contatti non cancellano il numero gia' salvato che la bozza non nomina", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "free", telefono: "0212345", telefono_whatsapp: "3331234567" })
    );
    const bozza = bozzaVuota();
    bozza.contatti = { telefono: "0299999", telefonoWhatsapp: null };

    await applicaBozzaOnboarding(bozza, diffVuoto());

    const fd = vi.mocked(aggiornaContatti).mock.calls[0][0];
    expect(fd.get("telefono")).toBe("0299999");
    expect(fd.get("telefono_whatsapp")).toBe("3331234567");
  });

  it("i promemoria non vengono proposti a un piano che non li ha", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.promemoria = { orePreavviso: [24] };

    await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiungiRegolaPromemoria).not.toHaveBeenCalled();
  });

  it("su un piano con i promemoria ne crea uno per ogni preavviso", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "growth" }));
    const bozza = bozzaVuota();
    bozza.promemoria = { orePreavviso: [24, 2] };

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    expect(aggiungiRegolaPromemoria).toHaveBeenCalledTimes(2);
    expect(risultato.promemoriaCreati).toBe(2);
  });

  it("la caparra arriva con tipo e valore, mai attiva a meta'", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.caparra = { attiva: true, tipo: "percentuale", valore: 30 };

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    const fd = vi.mocked(aggiornaCaparra).mock.calls[0][0];
    expect(fd.get("tipo")).toBe("percentuale");
    expect(fd.get("valore")).toBe("30");
    expect(risultato.caparraSalvata).toBe(true);
  });

  it("una chiusura con un periodo passa le due date all'azione", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.chiusure = [
      {
        dataInizio: "2026-08-10",
        dataFine: "2026-08-20",
        operatore: null,
        giornoIntero: true,
        oraInizio: null,
        oraFine: null,
        motivo: "Ferie",
      },
    ];

    const risultato = await applicaBozzaOnboarding(bozza, diffVuoto());

    const fd = vi.mocked(aggiungiChiusura).mock.calls[0][0];
    expect(fd.get("data_inizio")).toBe("2026-08-10");
    expect(fd.get("data_fine")).toBe("2026-08-20");
    expect(fd.get("motivo")).toBe("Ferie");
    expect(risultato.chiusureCreate).toBe(1);
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
