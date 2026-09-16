import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 4 (punto 27 di CLAUDE.md): il cliente chiede un servizio che il
 * salone non offre affatto. Non esiste un errore di codice dedicato per
 * questo caso -- è la REGOLA ASSOLUTA 1 del prompt (agente.ts) a vietare
 * all'AI di inventare servizi non restituiti da `elenca_servizi`. Per
 * natura, la risposta esatta dell'AI non è testabile parola per parola
 * (potrebbe rifiutare, scusarsi, proporre un servizio simile...): l'unica
 * cosa verificabile con certezza è che NESSUN appuntamento venga creato per
 * un servizio che non esiste in questo tenant.
 */
test.describe("Scenario 4 -- cliente chiede un servizio inesistente", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI non inventa né prenota un servizio che il salone non offre", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario4",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Sara", servizi: [0] }],
    });

    const telefono = "3339990004";
    const giorno = prossimoGiornoAperto();

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    const risposta = await inviaMessaggioChat(
      page,
      `Ciao, vorrei prenotare un tatuaggio il ${giorno.etichettaGiornoMese} alle 15:00. Mi chiamo Marco Neri, il mio numero è ${telefono}.`
    );

    expect(risposta.trim().length, "l'AI deve comunque rispondere qualcosa, non restare muta").toBeGreaterThan(0);

    const { data: appuntamenti } = await tenant.supabase
      .from("appuntamenti")
      .select("id, servizi(nome)")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    expect(
      appuntamenti?.length ?? 0,
      "nessun appuntamento deve essere stato creato per un servizio che questo tenant non offre"
    ).toBe(0);
  });
});
