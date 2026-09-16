import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";

/**
 * Scenario 6 (punto 30): attività chiusa -- il cliente chiede un giorno in
 * cui il tenant non lavora mai (domenica, chiusa di default nei tenant di
 * prova). Ri-verifica end-to-end un bug reale trovato e corretto in
 * precedenza (vedi PIANO.md/DECISIONS.md, "AI propone lista d'attesa anche
 * per giorni completamente chiusi"): niente riga in lista d'attesa con
 * `data_preferita` = quel giorno chiuso, e nessun appuntamento creato.
 */
test.describe("Scenario 6 -- attività chiusa quel giorno", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI non prenota né mette in lista d'attesa per un giorno completamente chiuso", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario6",
      piano: "growth",
      servizi: [{ nome: "Barba", durataMinuti: 20, prezzoCentesimi: 1500 }],
      operatori: [{ nome: "Marco", servizi: [0] }],
    });

    // Prossima domenica (chiusa di default): calcolata a parte da
    // prossimoGiornoAperto() apposta, qui serve il giorno CHIUSO, non il
    // prossimo aperto.
    const oggi = new Date();
    const prossimaDomenica = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate() + 1));
    while (prossimaDomenica.getUTCDay() !== 0) prossimaDomenica.setUTCDate(prossimaDomenica.getUTCDate() + 1);
    const ymd = prossimaDomenica.toISOString().slice(0, 10);
    const etichetta = `${String(prossimaDomenica.getUTCDate()).padStart(2, "0")}/${String(prossimaDomenica.getUTCMonth() + 1).padStart(2, "0")}`;

    const telefono = "3339990006";
    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    await inviaMessaggioChat(
      page,
      `Ciao, vorrei una Barba domenica ${etichetta} alle 10:00. Mi chiamo Paolo Neri, il mio numero è ${telefono}.`
    );
    await inviaMessaggioChat(page, "Va bene, mettimi pure in lista d'attesa per quel giorno preciso allora.");

    const { data: appuntamenti } = await tenant.supabase
      .from("appuntamenti")
      .select("id, clienti(telefono)")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    const nessunAppuntamento = !(appuntamenti ?? []).some((a) => {
      const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
      return cliente?.telefono === telefono;
    });
    expect(nessunAppuntamento, "creato un appuntamento in un giorno completamente chiuso").toBe(true);

    const { data: listaAttesa } = await tenant.supabase
      .from("lista_attesa")
      .select("id, data_preferita, cliente_telefono")
      .eq("tenant_id", tenant.id)
      .eq("cliente_telefono", telefono);
    const nessunaAttesaSulGiornoChiuso = !(listaAttesa ?? []).some((r) => r.data_preferita === ymd);
    expect(
      nessunaAttesaSulGiornoChiuso,
      "trovata una riga di lista d'attesa con data_preferita su un giorno completamente chiuso -- stesso bug corretto in precedenza, vedi DECISIONS.md"
    ).toBe(true);
  });
});
