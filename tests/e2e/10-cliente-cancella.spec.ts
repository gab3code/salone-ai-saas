import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { secondoGiornoAperto } from "./helpers/date";

/**
 * Scenario 10 -- il cliente cancella un appuntamento DAL SUO LINK PERSONALE.
 *
 * Fino al 17/09/2026 la cancellazione avveniva in chat, dettando il proprio
 * numero di telefono. Quella strada è stata chiusa dalla revisione di
 * sicurezza: nella chat pubblica un numero dettato non prova niente, e
 * chiunque poteva cancellare gli appuntamenti di chiunque altro (vedi lo
 * Scenario 2, che adesso è la prova che non si può più). Il percorso vero del
 * cliente è il link `/gestisci/<id>` che riceve nella mail di conferma e nel
 * promemoria: un UUID che ha solo lui.
 *
 * Cambia da dove parte il gesto, non cosa deve succedere dopo, ed è quel
 * "dopo" che questo scenario protegge. `cancellaAppuntamentoTenant` (booking-engine.server.ts, "single
 * source of truth" condivisa con la dashboard) non elimina MAI la riga --
 * la marca `stato="cancellato"` -- e prova anche a far scattare la lista
 * d'attesa (`trovaEAvvisaListaAttesa`): se esiste un candidato compatibile
 * in stato `in_attesa`, lo passa a `proposto` indipendentemente dal fatto
 * che il contatto automatico via email/SMS sia attivo per questo tenant
 * (quella è solo la NOTIFICA, gated a parte -- lo stato cambia comunque).
 */
test.describe("Scenario 10 -- il cliente cancella un appuntamento via chat", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'appuntamento passa a cancellato (mai eliminato) e la lista d'attesa compatibile viene avvisata", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario10",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Sara", servizi: [0] }],
    });

    const telefono = "3339990010";
    // SECONDO giorno aperto, non il primo (18/09/2026).
    //
    // Con il primo, questo test passava solo se lanciato di mattina: la
    // cancellazione online si chiude nelle 24 ore prima dell'appuntamento
    // (ore_minime_cancellazione, 24 di default), e "domani alle 10:00"
    // lanciato di sera dista meno di 24 ore -- il pulsante "Cancella la
    // prenotazione" spariva correttamente e il test aspettava per un minuto
    // un pulsante che il prodotto aveva ragione a non mostrare.
    //
    // Il secondo giorno aperto dista sempre piu' di 34 ore, a qualunque ora
    // giri la suite. Il limite delle 24 ore resta quello vero: non lo si
    // abbassa sul tenant di prova, cosi' questo scenario continua a girare
    // sulle stesse impostazioni di un salone reale.
    const giorno = secondoGiornoAperto();
    const servizio = tenant.servizi[0];

    const appuntamento = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "10:00",
      clienteNome: "Luca Ferri",
      clienteTelefono: telefono,
    });

    // Un candidato in lista d'attesa per lo stesso servizio, qualunque
    // operatore/giorno vada bene -- deve essere proposto non appena si
    // libera un qualunque slot compatibile.
    const { data: rigaListaAttesa } = await tenant.supabase
      .from("lista_attesa")
      .insert({
        tenant_id: tenant.id,
        servizio_id: servizio.id,
        operatore_id: null,
        cliente_nome: "Cliente In Attesa",
        cliente_telefono: "3339990099",
        data_preferita: null,
        stato: "in_attesa",
      })
      .select("id")
      .single();

    await page.goto(`/gestisci/${appuntamento.id}`);
    await page.getByRole("button", { name: "Cancella la prenotazione" }).click();
    await page.getByRole("button", { name: "Sì, cancella" }).click();

    async function statoAttuale() {
      const { data } = await tenant.supabase.from("appuntamenti").select("stato").eq("id", appuntamento.id).single();
      return data?.stato ?? null;
    }

    await expect
      .poll(statoAttuale, { timeout: 15_000, message: "la cancellazione dal link personale deve passare" })
      .toBe("cancellato");

    // Mai una delete fisica: la riga esiste ancora, solo con stato diverso.
    const { data: rigaAncoraEsistente } = await tenant.supabase
      .from("appuntamenti")
      .select("id")
      .eq("id", appuntamento.id)
      .maybeSingle();
    expect(rigaAncoraEsistente, "l'appuntamento cancellato non deve mai essere eliminato fisicamente").toBeTruthy();

    const { data: listaAttesaAggiornata } = await tenant.supabase
      .from("lista_attesa")
      .select("stato, slot_liberato_inizio")
      .eq("id", rigaListaAttesa!.id)
      .single();
    expect(listaAttesaAggiornata?.stato, "il candidato compatibile in lista d'attesa deve passare a 'proposto'").toBe(
      "proposto"
    );
    expect(listaAttesaAggiornata?.slot_liberato_inizio).toBeTruthy();
  });
});
