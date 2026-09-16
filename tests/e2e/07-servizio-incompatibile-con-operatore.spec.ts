import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 7 (punto 27 di CLAUDE.md): il cliente chiede un servizio con un
 * operatore che non lo esegue. Doppia difesa nel codice vero
 * (booking-engine.server.ts): in LETTURA `verifica_disponibilita` non
 * restituisce mai uno slot per una coppia operatore/servizio incompatibile
 * (filtrata da `operatori_servizi`); in SCRITTURA `verificaOperatoreCompatibile`
 * blocca comunque `crea_prenotazione` anche se qualcuno la chiamasse con un
 * input diverso da quanto restituito dalla disponibilità -- aggiunta in un
 * audit di sicurezza il 15/09/2026 proprio perché prima esisteva solo il
 * controllo in lettura. Come per lo Scenario 4, mai un confronto sul testo
 * esatto dell'AI: l'unica cosa verificabile con certezza è che non compaia
 * MAI in database un appuntamento con la coppia servizio/operatore sbagliata.
 */
test.describe("Scenario 7 -- servizio incompatibile con l'operatore richiesto", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI non prenota mai un servizio con un operatore che non lo esegue", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario7",
      piano: "growth",
      servizi: [
        { nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 },
        { nome: "Colore", durataMinuti: 90, prezzoCentesimi: 6000 },
      ],
      // Anna fa SOLO Taglio, Bruno fa SOLO Colore -- nessuna sovrapposizione.
      operatori: [
        { nome: "Anna", servizi: [0] },
        { nome: "Bruno", servizi: [1] },
      ],
    });

    const telefono = "3339990007";
    const giorno = prossimoGiornoAperto();

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    const risposta = await inviaMessaggioChat(
      page,
      `Ciao, vorrei un Colore con Anna il ${giorno.etichettaGiornoMese} alle 15:00. Mi chiamo Elisa Fontana, il mio numero è ${telefono}.`
    );
    expect(risposta.trim().length).toBeGreaterThan(0);

    const anna = tenant.operatori.find((o) => o.nome === "Anna")!;
    const colore = tenant.servizi.find((s) => s.nome === "Colore")!;

    const { data: appuntamentiSbagliati } = await tenant.supabase
      .from("appuntamenti")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("operatore_id", anna.id)
      .eq("servizio_id", colore.id)
      .neq("stato", "cancellato");
    expect(
      appuntamentiSbagliati?.length ?? 0,
      "non deve mai esistere un appuntamento 'Colore' assegnato ad Anna, che non lo esegue"
    ).toBe(0);
  });
});
