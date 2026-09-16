import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 1 (punto 30): nuovo cliente -> conversazione -> AI -> prenotazione
 * -> calendario -> CRM -> reminder.
 *
 * Chiama il vero Claude (decisione con Gabriel 16/09/2026: questi scenari
 * valgono la pena solo se verificano che l'AI capisca davvero la
 * conversazione, non solo che "se chiama questo tool succede la cosa giusta"
 * -- quello lo fa già tools.test.ts con un'AI finta). Il turno via chat
 * costa qualche centesimo di token: normale per un run a comando, non da
 * lanciare ad ogni push.
 *
 * L'unica cosa verificata con certezza è lo STATO nel database e sulle altre
 * schermate (calendario, CRM) -- mai un confronto testuale sulla risposta
 * dell'AI, che è per natura non deterministica parola per parola.
 */
test.describe("Scenario 1 -- nuovo cliente, conversazione AI, prenotazione end-to-end", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("un cliente nuovo prenota in chat e l'appuntamento compare su calendario e CRM", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario1",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Sara", servizi: [0] }],
    });

    const giorno = prossimoGiornoAperto();
    const telefono = "3339990001";

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    const risposta = await inviaMessaggioChat(
      page,
      `Ciao, vorrei prenotare un Taglio il ${giorno.etichettaGiornoMese} alle 11:00. Mi chiamo Anna Bianchi, il mio numero è ${telefono}.`
    );

    // L'AI potrebbe aver bisogno di un secondo giro (es. chiede conferma, o
    // propone un orario alternativo se per qualche motivo 11:00 non fosse
    // libero) -- diamole fino a due turni in più prima di controllare il
    // database, invece di pretendere che risolva tutto al primo messaggio.
    let confermato = await appuntamentoEsisteNelDb();
    let tentativi = 0;
    let ultimaRisposta = risposta;
    while (!confermato && tentativi < 2) {
      ultimaRisposta = await inviaMessaggioChat(page, "Sì, va bene, confermo pure un altro orario libero se quello non c'è.");
      confermato = await appuntamentoEsisteNelDb();
      tentativi++;
    }

    expect(confermato, `L'AI non ha creato la prenotazione entro 3 turni. Ultima risposta: "${ultimaRisposta}"`).toBe(true);

    async function appuntamentoEsisteNelDb() {
      const { data } = await tenant.supabase
        .from("appuntamenti")
        .select("id, inizio, fine, stato, clienti(nome, telefono), servizi(nome), operatori(nome)")
        .eq("tenant_id", tenant.id)
        .neq("stato", "cancellato");
      return (data ?? []).some((a) => {
        const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
        return cliente?.telefono === telefono;
      });
    }

    const { data: righe } = await tenant.supabase
      .from("appuntamenti")
      .select("id, inizio, clienti(nome, telefono), servizi(nome), operatori(nome)")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    const riga = (righe ?? []).find((a) => {
      const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
      return cliente?.telefono === telefono;
    });
    expect(riga, "riga appuntamento non trovata dopo la conferma").toBeTruthy();
    const servizioNome = Array.isArray(riga!.servizi) ? riga!.servizi[0]?.nome : (riga!.servizi as { nome: string })?.nome;
    const operatoreNome = Array.isArray(riga!.operatori) ? riga!.operatori[0]?.nome : (riga!.operatori as { nome: string })?.nome;
    expect(servizioNome).toBe("Taglio");
    expect(operatoreNome).toBe("Sara");

    // Calendario: lo stesso appuntamento visibile dalla dashboard del titolare.
    // Locator scoperto sul <li> della riga appuntamento (non su tutta la
    // pagina): "Taglio" compare ANCHE nel pannello "Nuovo appuntamento" a
    // fianco (la checkbox del servizio), quindi un getByText("Taglio") sulla
    // pagina intera è ambiguo (strict mode violation, trovato lanciando il
    // test il 16/09/2026) -- scoping alla riga specifica lo rende univoco.
    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto(`/dashboard/calendario?data=${giorno.ymd}`);
    const rigaAppuntamento = page.locator("li", { hasText: "Anna Bianchi" });
    await expect(rigaAppuntamento).toBeVisible();
    await expect(rigaAppuntamento).toContainText("Taglio");

    // CRM: il cliente creato automaticamente dall'AI compare nella lista clienti.
    await page.goto("/dashboard/clienti");
    await expect(page.getByText("Anna Bianchi")).toBeVisible();
    await expect(page.getByText(telefono)).toBeVisible();

    // Reminder: non si invoca qui il cron dei promemoria (già coperto a
    // fondo da test unitari dedicati, vedi PIANO.md Fase 3) -- ci si limita
    // a verificare che l'appuntamento creato sia un bersaglio valido per
    // esso (stato "confermato", data futura), cioè che questo scenario non
    // abbia lasciato l'appuntamento in uno stato che lo escluderebbe.
    const { data: rigaStato } = await tenant.supabase.from("appuntamenti").select("stato").eq("id", riga!.id).single();
    expect(rigaStato?.stato).toBe("confermato");
  });
});
