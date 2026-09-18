import { test, expect } from "@playwright/test";
import { RISPOSTA_MESSAGGIO_OFFENSIVO } from "@/lib/ai/messaggio-offensivo";
import { TURNI_FUORI_TEMA_DEMO } from "@/lib/demo/limiti-demo";
import { creaClientAdminTest } from "./helpers/supabase-admin";

/**
 * Scenario 27 (17/09/2026): un messaggio offensivo sulla demo.
 *
 * Nasce da una prova dal vivo di Gabriel: a un insulto secco l'assistente
 * rispondeva "Mi dispiace, ma non ho capito bene. Puoi ripetere?". Chiedeva
 * di ripetere un insulto.
 *
 * Questo scenario NON COSTA NIENTE, ed e' il motivo per cui puo' stare in
 * una suite che gira spesso: il riconoscimento avviene prima della chiamata
 * al modello, quindi qui Anthropic non viene mai interpellato. Non crea
 * nessun tenant e non consuma il contatore globale della demo. E'
 * deterministico al 100%: la risposta e' una costante del codice, non un
 * testo generato.
 *
 * UNA RIGA LA SCRIVE PERO', e per mesi questo commento ha detto il
 * contrario. Trovato il 18/09/2026, quando il secondo test e' diventato
 * rosso da solo senza che nessuno avesse toccato la demo.
 *
 * Il tetto che conta non e' quello globale ma quello PER CONNESSIONE
 * (MESSAGGI_DEMO_PER_CONNESSIONE_AL_MESE, venti al mese), e nella demo viene
 * controllato per primo, prima ancora del filtro sugli insulti: e' voluto,
 * serve a non dare tentativi infiniti a chi insulta. Effetto collaterale sui
 * test: ogni run di questo file consuma TRE di quei venti messaggi, sempre
 * dalla stessa impronta (quella del Mac di Gabriel), e si somma a ogni prova
 * fatta a mano su /demo. Alla settima run del mese il contatore arriva a
 * venti e il file diventa rosso per sempre fino al primo del mese.
 *
 * Era un test con una scadenza nascosta. Adesso il contatore di quella
 * connessione si azzera prima di partire: e' il database di prova, quelle
 * righe non servono a nessun altro. Il prodotto non e' cambiato -- il tetto
 * vale come prima per chiunque visiti la demo.
 *
 * Il caso opposto -- una richiesta vera che contiene una volgarita', che
 * deve passare -- non sta qui proprio perche' quello ARRIVA al modello e
 * costerebbe a ogni run: e' coperto dai test unitari in
 * src/lib/ai/messaggio-offensivo.test.ts, che lo verificano gratis.
 */

const INSULTO = "frocio";

test.describe("Scenario 27 -- messaggi offensivi sulla demo", () => {
  test.beforeEach(async () => {
    // `like` invece di un id preciso: l'impronta dipende dall'indirizzo visto
    // dal server e dal sale, che da qui non si ricostruiscono. Sono contatori
    // di un database di prova, si possono togliere tutti.
    const admin = creaClientAdminTest();
    await admin.from("contatori_globali").delete().like("chiave", "demo_ip:%");
  });

  test("risponde senza mai chiedere di ripetere, e alla seconda volta chiude", async ({ page }) => {
    await page.goto("/demo");

    const campo = page.getByLabel("Messaggio per l'assistente");
    const invia = page.getByRole("button", { name: "Invia" });
    await expect(campo).toBeEnabled();

    // --- primo insulto -------------------------------------------------
    await campo.fill(INSULTO);
    await invia.click();

    await expect(page.getByText(RISPOSTA_MESSAGGIO_OFFENSIVO)).toBeVisible();

    // La frase che ha fatto nascere tutto questo non deve comparire mai.
    const testoPagina = (await page.locator("body").innerText()).toLowerCase();
    expect(testoPagina).not.toContain("puoi ripetere");
    expect(testoPagina).not.toContain("non ho capito");

    // La conversazione NON e' ancora chiusa: un turno solo non basta.
    expect(TURNI_FUORI_TEMA_DEMO).toBeGreaterThan(1);
    await expect(campo).toBeEnabled();

    // --- secondo insulto: si chiude ------------------------------------
    await campo.fill(INSULTO);
    await invia.click();

    await expect(page.getByText(/registrati/i).last()).toBeVisible();
    await expect(campo).toBeDisabled();
    await expect(campo).toHaveAttribute("placeholder", "Ricarica la pagina per ricominciare");
  });

  test("i trucchi per aggirare il filtro non funzionano", async ({ page }) => {
    await page.goto("/demo");

    const campo = page.getByLabel("Messaggio per l'assistente");
    await campo.fill("Fr0ci0");
    await page.getByRole("button", { name: "Invia" }).click();

    await expect(page.getByText(RISPOSTA_MESSAGGIO_OFFENSIVO)).toBeVisible();
  });
});
