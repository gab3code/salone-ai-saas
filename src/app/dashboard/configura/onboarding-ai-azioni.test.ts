import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { generaBozzaOnboarding } from "@/lib/onboarding-ai.server";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import { creaOperatore, creaServizio, impostaAssociazioneOperatoreServizio, salvaOrari } from "./azioni";
import { aggiornaInformazioniAttivita, aggiungiFaq } from "../impostazioni/informazioni-attivita/azioni";
import { aggiornaFinestraCancellazione } from "../impostazioni/cancellazione/azioni";
import { applicaBozzaOnboarding, generaBozzaOnboardingAction } from "./onboarding-ai-azioni";

/**
 * Ogni dipendenza è mockata: questo file verifica SOLO l'orchestrazione di
 * applicaBozzaOnboarding/generaBozzaOnboardingAction (quali azioni chiama,
 * in che ordine, con quali guardie) -- non la logica delle azioni granulari
 * stesse, già coperta dai loro punti di validazione esistenti (limiti di
 * piano, formati, ecc.), né l'estrazione AI vera, già coperta da
 * onboarding-ai.server.test.ts.
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
    associazioni: [],
    informazioniAttivita: null,
    faq: [],
    oreMinimeCancellazione: null,
  };
}

/** Costruisce un finto client Supabase che risponde `rigaTenant` a
 *  qualunque `.from("tenants").select(...).eq(...).single()`. */
function supabaseFinto(rigaTenant: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data: rigaTenant, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
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

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", true);
  });

  it("il piano Free non abilita la knowledge base", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(generaBozzaOnboarding).mockResolvedValue({ ok: true, bozza: bozzaVuota() });

    await generaBozzaOnboardingAction("Descrizione di prova");

    expect(generaBozzaOnboarding).toHaveBeenCalledWith("Descrizione di prova", false);
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

    const risultato = await applicaBozzaOnboarding(bozzaVuota());

    expect(salvaOrari).not.toHaveBeenCalled();
    expect(risultato.orariSalvati).toBe(false);
  });

  it("salva gli orari solo quando almeno un giorno è aperto", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    const bozza = bozzaVuota();
    bozza.orari[1] = { giornoSettimana: 1, chiuso: false, apertura: "09:00", chiusura: "18:00", pausaInizio: null, pausaFine: null };

    const risultato = await applicaBozzaOnboarding(bozza);

    expect(salvaOrari).toHaveBeenCalledTimes(1);
    const formInviato = vi.mocked(salvaOrari).mock.calls[0][0];
    expect(formInviato.get("apertura_1")).toBe("09:00");
    expect(formInviato.get("chiuso_0")).toBe("on"); // domenica, rimasta chiusa di default
    expect(risultato.orariSalvati).toBe(true);
  });

  it("crea operatori e servizi e li associa quando la bozza non specifica associazioni esplicite", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore).mockResolvedValue({ ok: true, id: "op-1" });
    vi.mocked(creaServizio).mockResolvedValue({ ok: true, id: "serv-1" });

    const bozza = bozzaVuota();
    bozza.operatori = [{ nome: "Maria", descrizione: null }];
    bozza.servizi = [{ nome: "Manicure", durataMinuti: 30, prezzoEuro: 20 }];

    const risultato = await applicaBozzaOnboarding(bozza);

    expect(creaOperatore).toHaveBeenCalledTimes(1);
    expect(creaServizio).toHaveBeenCalledTimes(1);
    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledWith("op-1", "serv-1", true);
    expect(risultato).toMatchObject({ operatoriCreati: 1, serviziCreati: 1, associazioniCreate: 1 });
  });

  it("rispetta le associazioni esplicite della bozza invece del default tutti-con-tutti", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore)
      .mockResolvedValueOnce({ ok: true, id: "op-maria" })
      .mockResolvedValueOnce({ ok: true, id: "op-luca" });
    vi.mocked(creaServizio).mockResolvedValue({ ok: true, id: "serv-manicure" });

    const bozza = bozzaVuota();
    bozza.operatori = [
      { nome: "Maria", descrizione: null },
      { nome: "Luca", descrizione: null },
    ];
    bozza.servizi = [{ nome: "Manicure", durataMinuti: 30, prezzoEuro: 20 }];
    bozza.associazioni = [{ operatore: "Maria", servizio: "Manicure" }];

    await applicaBozzaOnboarding(bozza);

    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledTimes(1);
    expect(impostaAssociazioneOperatoreServizio).toHaveBeenCalledWith("op-maria", "serv-manicure", true);
  });

  it("riporta un fallimento parziale (es. limite di piano) senza bloccare il resto della bozza", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free" }));
    vi.mocked(creaOperatore)
      .mockResolvedValueOnce({ ok: true, id: "op-1" })
      .mockResolvedValueOnce({ errore: "Il piano Free è limitato a 1 operatore." });

    const bozza = bozzaVuota();
    bozza.operatori = [
      { nome: "Maria", descrizione: null },
      { nome: "Luca", descrizione: null },
    ];

    const risultato = await applicaBozzaOnboarding(bozza);

    expect(risultato.operatoriCreati).toBe(1);
    expect(risultato.errori).toEqual(expect.arrayContaining([expect.stringMatching(/Luca.*limitato a 1 operatore/)]));
  });

  it("mantiene descrizione/parcheggio già salvati quando la bozza fornisce solo l'indirizzo", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(
      supabaseFinto({ piano: "pro", descrizione: "Salone accogliente", parcheggio: "Cortile interno", indirizzo: null, metodi_pagamento: null })
    );

    const bozza = bozzaVuota();
    bozza.informazioniAttivita = { descrizione: null, indirizzo: "Via Roma 1", parcheggio: null, metodiPagamento: null };

    await applicaBozzaOnboarding(bozza);

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

    await applicaBozzaOnboarding(bozza);

    expect(aggiornaInformazioniAttivita).not.toHaveBeenCalled();
  });

  it("preserva il telefono esistente quando applica solo la finestra di cancellazione", async () => {
    vi.mocked(creaClientServer).mockResolvedValue(supabaseFinto({ piano: "free", telefono: "3331234567" }));
    const bozza = bozzaVuota();
    bozza.oreMinimeCancellazione = 24;

    await applicaBozzaOnboarding(bozza);

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

    const risultato = await applicaBozzaOnboarding(bozza);

    expect(aggiungiFaq).toHaveBeenCalledTimes(2);
    expect(risultato.faqCreate).toBe(2);
  });
});
