import { test, expect } from "@playwright/test";
import { creaClientAnonimoTest } from "./helpers/supabase-admin";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { DEMO_AI_MAX_AL_MESE } from "@/lib/ai/demo-assistente";

/**
 * Scenario 26 (17/09/2026): la pagina Analytics rifatta (chiusura della
 * Fase 3) e la prova dell'assistente per i piani senza AI (chiusura della
 * Fase 5).
 *
 * Cosa NON c'e' qui, di proposito: nessun test preme "Guarda cosa avrebbe
 * risposto". Quel pulsante fa una chiamata VERA al modello e consuma una
 * delle dieci prove mensili del tenant, quindi in una suite che gira decine
 * di volte al giorno sarebbe una spesa continua e un test non
 * deterministico (la risposta del modello cambia ogni volta). Qui si
 * verifica tutto quello che sta INTORNO -- che il riquadro compaia solo
 * dove deve, e che il limite regga anche contro il database nudo -- mentre
 * la logica pura (piani, quota, finestra del mese, strumenti concessi) ha i
 * suoi 16 test in `src/lib/ai/demo-assistente.test.ts`.
 */

/** Giorno civile a N giorni da oggi, in formato YYYY-MM-DD (UTC). */
function giorniFa(n: number): string {
  return ymd(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Il prossimo giorno di apertura (il tenant di prova e' chiuso la domenica).
 *
 * Si prenota SEMPRE in un giorno futuro, mai oggi: gli slot liberi di oggi
 * sono solo quelli ancora da venire, quindi una suite lanciata alle 18:50 su
 * un salone che chiude alle 19 non ne troverebbe nessuno e il test
 * fallirebbe per l'ora, non per un difetto.
 */
function prossimoGiornoAperto(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return ymd(d);
}

/**
 * Inserisce un appuntamento dal form della dashboard, come farebbe il
 * titolare al telefono. Non usa l'helper via service_role di proposito: qui
 * il punto e' proprio il giro completo dall'interfaccia, perche' e' quello
 * che fa comparire il riquadro.
 */
async function inserisciAppuntamentoAMano(
  page: import("@playwright/test").Page,
  tenant: TenantDiProva,
  telefono: string
) {
  // Il servizio si passa nell'indirizzo invece di spuntare la casella: la
  // casella e' controllata da React e fa comunque un router.push con lo
  // stesso parametro, quindi questo e' lo stesso stato con un passaggio in
  // meno che puo' andare storto.
  await page.goto(
    `/dashboard/calendario?data=${prossimoGiornoAperto()}&servizio_id=${tenant.servizi[0].id}`
  );

  const orari = page.getByRole("button", { name: /^\d{2}:\d{2}( · .+)?$/ });
  await expect(orari.first(), "il giorno scelto deve avere orari liberi").toBeVisible();
  await orari.first().click();

  await page.locator('input[name="cliente_nome"]').fill("Cliente al telefono");
  await page.locator('input[name="cliente_telefono"]').fill(telefono);
  await page.getByRole("button", { name: "Conferma prenotazione" }).click();
}

test.describe("Scenario 26 -- Analytics e prova dell'assistente", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("Analytics resta chiusa sotto Growth, con l'upsell e non una pagina vuota", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 gate", piano: "starter" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/analytics");

    await expect(page.getByText("Analytics è incluso dal piano")).toBeVisible();
    await expect(page.getByRole("link", { name: "Passa a Growth" })).toBeVisible();
    // Il selettore di periodo non deve nemmeno esserci: sarebbe un comando
    // che non comanda niente.
    await expect(page.getByRole("group", { name: "Periodo da visualizzare" })).toHaveCount(0);
  });

  test("il periodo scelto resta nell'indirizzo e cambia la granularità del grafico", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 periodo", piano: "growth" });
    await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorniFa(3),
      oraHHMM: "10:00",
      clienteTelefono: "3330000001",
    });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/analytics");

    // Predefinito: 3 mesi, per settimana.
    await expect(page.getByText("3 mesi, per settimana")).toBeVisible();

    await page.getByRole("link", { name: "4 settimane" }).click();
    await expect(page).toHaveURL(/periodo=28g/);
    await expect(page.getByText("4 settimane, giorno per giorno")).toBeVisible();

    await page.getByRole("link", { name: "12 mesi" }).click();
    await expect(page.getByText("12 mesi, per mese")).toBeVisible();

    // Un periodo inventato non rompe la pagina: ricade sul predefinito.
    await page.goto("/dashboard/analytics?periodo=inventato");
    await expect(page.getByText("3 mesi, per settimana")).toBeVisible();
  });

  test("la retention conta solo chi ha avuto il tempo di tornare", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 retention", piano: "growth" });

    // Sei clienti "maturi": prima visita 200 giorni fa, ritorno dopo 10
    // giorni. Sopra la soglia dei 5, quindi la percentuale esce.
    // Un'ora diversa per ogni cliente: il tenant di prova ha un operatore
    // solo, e il database ha un vincolo di esclusione (`niente_sovrapposizioni`)
    // che impedisce due appuntamenti sovrapposti sulla stessa persona. Con
    // tutti alle 10:00 il secondo inserimento fallisce -- ed e' giusto che
    // fallisca, e' lo stesso vincolo che protegge un'agenda vera.
    // Il servizio predefinito dura 30 minuti e il salone apre 9-19, quindi
    // sei slot orari da 09:00 in poi stanno larghi.
    for (let i = 0; i < 6; i++) {
      const ora = `${String(9 + i).padStart(2, "0")}:00`;
      const { clienteId } = await creaAppuntamentoConfermato(tenant, {
        giornoYMD: giorniFa(200),
        oraHHMM: ora,
        clienteNome: `Maturo ${i}`,
        clienteTelefono: `33311100${String(i).padStart(2, "0")}`,
      });
      // STESSO cliente, non uno nuovo: due visite di una persona sola.
      await creaAppuntamentoConfermato(tenant, {
        giornoYMD: giorniFa(190),
        oraHHMM: ora,
        clienteTelefono: `33311100${String(i).padStart(2, "0")}`,
        clienteIdEsistente: clienteId,
      });
    }
    // Un cliente arrivato ieri: non ha ancora avuto il tempo di tornare e
    // NON deve peggiorare la percentuale di nessuna riga.
    await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorniFa(1),
      oraHHMM: "16:00",
      clienteNome: "Appena arrivato",
      clienteTelefono: "3339999999",
    });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/analytics");

    const blocco = page.locator("section, div").filter({ hasText: "Quanti clienti tornano" }).last();
    await expect(blocco).toBeVisible();

    // La riga "entro 1 mese" deve dire 100% su 6 clienti: i sei maturi sono
    // tutti tornati, e il settimo non e' contato.
    const rigaMese = page.locator("div").filter({ hasText: /^entro 1 mese/ }).first();
    await expect(rigaMese).toContainText("100%");
    await expect(rigaMese).toContainText("su 6 clienti");
  });

  test("dopo un appuntamento inserito a mano, uno Starter vede la prova dell'assistente", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 upsell", piano: "starter" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/calendario");

    // Prima di inserire niente il riquadro non c'e': e' legato al momento,
    // non alla pagina.
    await expect(page.getByText("Questo appuntamento l'hai preso tu")).toHaveCount(0);

    await inserisciAppuntamentoAMano(page, tenant, "3334445556");

    await expect(page.getByText("Questo appuntamento l'hai preso tu")).toBeVisible();
    await expect(page.getByText(`restano ${DEMO_AI_MAX_AL_MESE} prove questo mese`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guarda cosa avrebbe risposto" })).toBeEnabled();
  });

  test("su Growth la prova non compare: l'assistente ce l'ha già", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 no upsell", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await inserisciAppuntamentoAMano(page, tenant, "3334445557");

    // L'appuntamento e' stato creato davvero (il form si chiude), ma il
    // riquadro commerciale non compare: l'assistente ce l'ha gia'.
    await expect(page.getByRole("button", { name: "Conferma prenotazione" })).toHaveCount(0);
    await expect(page.getByText("Questo appuntamento l'hai preso tu")).toHaveCount(0);
  });

  test("il tetto delle prove non si azzera dal database nudo", async () => {
    // Stesso metodo dello Scenario 23: si parla con PostgREST usando la anon
    // key (che e' pubblica: sta nel bundle che ogni visitatore scarica) e il
    // JWT del titolare. Se il limite vivesse solo nel codice della server
    // action, queste due chiamate lo aggirerebbero entrambe.
    tenant = await creaTenantDiProva({ nome: "Salone E2E S26 limite", piano: "starter" });

    // Il database e' quello dei test, non quello di .env.local: vedi la nota
    // in helpers/supabase-admin.ts.
    const comeTitolare = creaClientAnonimoTest();
    const { error: erroreLogin } = await comeTitolare.auth.signInWithPassword({
      email: tenant.email,
      password: tenant.password,
    });
    if (erroreLogin) throw new Error(`Login diretto fallito: ${erroreLogin.message}`);

    // Partenza: quota consumata per intero.
    await tenant.supabase
      .from("tenants")
      .update({ demo_ai_mese: new Date().toISOString().slice(0, 7), demo_ai_usate: DEMO_AI_MAX_AL_MESE })
      .eq("id", tenant.id);

    // 1. Riscrivere il contatore a mano.
    await comeTitolare.from("tenants").update({ demo_ai_usate: 0 }).eq("id", tenant.id);
    // 2. Cambiare il mese, che avrebbe lo stesso effetto.
    await comeTitolare.from("tenants").update({ demo_ai_mese: "1999-01" }).eq("id", tenant.id);
    // 3. Chiamare direttamente la funzione passandosi il limite che vuole.
    const { error: erroreRpc } = await comeTitolare.rpc("consuma_demo_ai", {
      p_tenant_id: tenant.id,
      p_limite: 999999,
    });
    expect(erroreRpc, "authenticated non deve poter eseguire consuma_demo_ai").not.toBeNull();

    // Si asserisce sul VALORE, non sull'errore: una colonna senza GRANT non
    // fa fallire la PATCH, fa passare zero righe -- che dal client sembra un
    // successo.
    const { data } = await tenant.supabase
      .from("tenants")
      .select("demo_ai_mese, demo_ai_usate")
      .eq("id", tenant.id)
      .single();
    expect(data?.demo_ai_usate, "il contatore non si azzera").toBe(DEMO_AI_MAX_AL_MESE);
    expect(data?.demo_ai_mese, "e nemmeno il mese si riscrive").not.toBe("1999-01");
  });
});
