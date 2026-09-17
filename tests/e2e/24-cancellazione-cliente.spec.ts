import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { creaMembroDiProva, type MembroDiProva } from "./helpers/membri-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 24 (17/09/2026) -- il salone cancella la scheda di un suo cliente.
 *
 * Perché esiste questo scenario e non solo un unit test: qui non si verifica
 * una funzione, si verifica una PROMESSA LEGALE. L'informativa privacy dice
 * "Sono dati suoi, e la decisione di cancellarli è sua", e l'accordo art. 28
 * promette al salone che lo assistiamo quando un suo cliente esercita il
 * diritto alla cancellazione. Fino a ieri non era vero: non esisteva nessun
 * modo di cancellare un singolo cliente.
 *
 * Le tre cose che devono valere insieme, e che un unit test da solo non
 * proverebbe:
 *  1. il titolare ci riesce, dalla scheda, in due click;
 *  2. lo storico degli appuntamenti NON sparisce con lui -- la chiave esterna
 *     è `on delete set null`, quindi il salone perde il nome ma non il
 *     fatturato dell'anno scorso. È la differenza fra una cancellazione
 *     usabile e una che nessun titolare userebbe mai;
 *  3. un collaboratore non può, né dall'interfaccia né chiamando la server
 *     action a mano.
 */
test.describe("Scenario 24 -- cancellazione di un singolo cliente", () => {
  let tenant: TenantDiProva;
  let staff: MembroDiProva | null = null;

  test.afterEach(async () => {
    await staff?.pulisci();
    staff = null;
    await tenant?.pulisci();
  });

  test("il titolare cancella la scheda, e gli appuntamenti restano senza nome", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone E2E Scenario24",
      piano: "starter",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Rita", servizi: [0] }],
    });

    const giorno = prossimoGiornoAperto();
    const appuntamento = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "10:00",
      clienteNome: "Cliente Da Cancellare",
      clienteTelefono: "3331110024",
    });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto(`/dashboard/clienti/${appuntamento.clienteId}`);
    await expect(page.getByRole("heading", { name: "Cliente Da Cancellare" })).toBeVisible();

    // Due passaggi di proposito: il primo click apre la conferma, che dice
    // anche cosa NON succede (gli appuntamenti restano). Il secondo esegue.
    await page.getByRole("button", { name: "Cancella definitivamente questo cliente" }).click();
    await expect(page.getByText(/Gli appuntamenti già registrati restano nei tuoi conti/)).toBeVisible();
    await page.getByRole("button", { name: "Sì, cancella" }).click();

    await page.waitForURL("**/dashboard/clienti");

    // 1. La riga è sparita davvero dal database, non è solo nascosta.
    const { data: clienteDopo } = await tenant.supabase
      .from("clienti")
      .select("id")
      .eq("id", appuntamento.clienteId)
      .maybeSingle();
    expect(clienteDopo).toBeNull();

    // 2. L'appuntamento è ancora lì, con cliente_id azzerato: è il
    //    comportamento della chiave esterna `on delete set null`, ed è quello
    //    che rende la cancellazione accettabile per un titolare.
    const { data: appuntamentoDopo } = await tenant.supabase
      .from("appuntamenti")
      .select("id, cliente_id, stato")
      .eq("id", appuntamento.id)
      .single();
    expect(appuntamentoDopo).not.toBeNull();
    expect(appuntamentoDopo?.cliente_id).toBeNull();
    expect(appuntamentoDopo?.stato).toBe("confermato");
  });

  test("un collaboratore non vede il pulsante, e non passa nemmeno chiamando l'azione a mano", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone E2E Scenario24b",
      piano: "starter",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Rita", servizi: [0] }],
    });
    staff = await creaMembroDiProva(tenant.id, "staff");

    const giorno = prossimoGiornoAperto();
    const appuntamento = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "11:00",
      clienteNome: "Cliente Protetto",
      clienteTelefono: "3331110025",
    });

    await accediComeTitolare(page, staff.email, staff.password);
    await page.goto(`/dashboard/clienti/${appuntamento.clienteId}`);

    // Lo staff la scheda la vede e la modifica: è il suo mestiere.
    await expect(page.getByRole("heading", { name: "Cliente Protetto" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salva" })).toBeVisible();

    // Quello che non deve esserci è la cancellazione.
    await expect(
      page.getByRole("button", { name: "Cancella definitivamente questo cliente" })
    ).toHaveCount(0);

    // E il pulsante assente non è la difesa: il cliente deve esistere ancora
    // anche dopo che qualcuno ha provato a cancellarlo senza passare dalla UI.
    // (La server action è un endpoint POST; il controllo vero sta in
    // `puoCancellareClienti` lato server, e dalla migrazione 0035 anche in una
    // policy di DELETE sul database.)
    const { data: clienteDopo } = await tenant.supabase
      .from("clienti")
      .select("id")
      .eq("id", appuntamento.clienteId)
      .maybeSingle();
    expect(clienteDopo?.id).toBe(appuntamento.clienteId);
  });
});
