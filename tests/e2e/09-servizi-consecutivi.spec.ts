import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 9 (punto 30): il cliente chiede più servizi consecutivi con lo
 * stesso operatore -- prima verifica end-to-end (via chat AI vera, non solo
 * i test unitari già in booking-engine.server.test.ts/tools.test.ts) della
 * funzionalità costruita in questo stesso giro di lavoro (16/09/2026, vedi
 * DECISIONS.md "Servizi consecutivi").
 */
test.describe("Scenario 9 -- più servizi consecutivi in chat", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI prenota due servizi di fila con la stessa operatrice, senza buchi tra i due", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario9",
      piano: "growth",
      servizi: [
        { nome: "Manicure", durataMinuti: 30, prezzoCentesimi: 2500 },
        { nome: "Pedicure", durataMinuti: 45, prezzoCentesimi: 3500 },
      ],
      operatori: [{ nome: "Giulia", servizi: [0, 1] }],
    });
    const giorno = prossimoGiornoAperto();
    const telefono = "3339990009";

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    await inviaMessaggioChat(
      page,
      `Ciao, vorrei Manicure e Pedicure di seguito con la stessa persona il ${giorno.etichettaGiornoMese} alle 10:00. Mi chiamo Giulia Rossi, il mio numero è ${telefono}.`
    );
    let ultimaRisposta = await inviaMessaggioChat(page, "Sì, confermo.");

    async function righeDelClienteAttuali() {
      const { data: righe } = await tenant.supabase
        .from("appuntamenti")
        .select("id, inizio, fine, operatore_id, gruppo_prenotazione_id, servizi(nome), clienti(telefono)")
        .eq("tenant_id", tenant.id)
        .neq("stato", "cancellato")
        .order("inizio");
      return (righe ?? []).filter((a) => {
        const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
        return cliente?.telefono === telefono;
      });
    }

    // Trovato dal vivo il 16/09/2026: su una prenotazione multi-servizio
    // (importo totale più alto, due righe da scrivere) l'AI a volte chiede
    // un'ultima conferma esplicita ("Procedo con la prenotazione... con
    // Giulia?") prima di chiamare davvero crea_prenotazione, invece di
    // procedere subito dopo il primo "sì" -- prudenza ragionevole su un
    // impegno più corposo, non un bug. Stesso pattern di ritentativo già
    // usato per gli altri scenari con l'AI.
    let righeDelCliente = await righeDelClienteAttuali();
    let tentativi = 0;
    while (righeDelCliente.length === 0 && tentativi < 2) {
      ultimaRisposta = await inviaMessaggioChat(page, "Sì, procedi pure con la prenotazione.");
      righeDelCliente = await righeDelClienteAttuali();
      tentativi++;
    }

    expect(
      righeDelCliente.length,
      `attese 2 righe (una per servizio), trovate ${righeDelCliente.length}. Ultima risposta: "${ultimaRisposta}"`
    ).toBe(2);
    const [prima, seconda] = righeDelCliente;
    expect(prima.gruppo_prenotazione_id, "le due righe devono condividere lo stesso gruppo_prenotazione_id").toBeTruthy();
    expect(prima.gruppo_prenotazione_id).toBe(seconda.gruppo_prenotazione_id);
    expect(prima.operatore_id).toBe(seconda.operatore_id);
    // Senza buchi: la fine del primo servizio combacia con l'inizio del secondo.
    expect(new Date(prima.fine).getTime()).toBe(new Date(seconda.inizio).getTime());

    const nomiServizi = righeDelCliente
      .map((r) => (Array.isArray(r.servizi) ? r.servizi[0]?.nome : (r.servizi as { nome: string })?.nome))
      .sort();
    expect(nomiServizi).toEqual(["Manicure", "Pedicure"]);
  });
});
