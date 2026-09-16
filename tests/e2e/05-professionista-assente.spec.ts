import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 5 (punto 30): professionista assente -- il cliente chiede
 * esplicitamente un'operatrice che quel giorno ha una chiusura (`chiusure`,
 * giorno_intero) e un'altra operatrice compatibile con lo stesso servizio è
 * invece libera.
 *
 * L'assert che conta davvero (indipendente da cosa scrive l'AI, per natura
 * non deterministica): NON deve mai comparire in `appuntamenti` una riga con
 * l'operatrice assente in quel giorno -- quello sarebbe un bug di sicurezza
 * del prodotto (prenotazione promessa a un cliente ma nessuno la onora),
 * non solo una risposta imprecisa in chat.
 */
test.describe("Scenario 5 -- professionista assente quel giorno", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI non prenota mai l'operatrice assente, anche se il cliente la chiede per nome", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario5",
      piano: "growth",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [
        { nome: "Sara", servizi: [0] },
        { nome: "Luca", servizi: [0] },
      ],
    });
    const sara = tenant.operatori.find((o) => o.nome === "Sara")!;
    const giorno = prossimoGiornoAperto();

    const { error: erroreChiusura } = await tenant.supabase.from("chiusure").insert({
      tenant_id: tenant.id,
      operatore_id: sara.id,
      data: giorno.ymd,
      giorno_intero: true,
      motivo: "Ferie (dato di prova)",
    });
    expect(erroreChiusura).toBeNull();

    const telefono = "3339990005";
    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    await inviaMessaggioChat(
      page,
      `Ciao, vorrei una Piega con Sara il ${giorno.etichettaGiornoMese} alle 11:00. Mi chiamo Elena Verdi, il mio numero è ${telefono}.`
    );
    // Un secondo turno per lasciare all'AI la possibilità di proporre
    // un'alternativa (altro operatore o altro orario) e per il cliente di
    // accettarla -- non è quello che si sta verificando, ma senza dargliela
    // il test rischierebbe di fallire per un motivo estraneo allo scenario.
    await inviaMessaggioChat(page, "Va bene anche con un'altra persona, o in un altro orario libero.");

    const { data: righe } = await tenant.supabase
      .from("appuntamenti")
      .select("operatore_id, inizio, clienti(telefono)")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    const righeDelCliente = (righe ?? []).filter((a) => {
      const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
      return cliente?.telefono === telefono;
    });
    const prenotataSuOperatriceAssente = righeDelCliente.some((a) => a.operatore_id === sara.id);
    expect(prenotataSuOperatriceAssente, "trovata una prenotazione sull'operatrice assente quel giorno -- bug di disponibilità").toBe(false);
  });
});
