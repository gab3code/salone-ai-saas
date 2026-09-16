import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 8 (punto 27 di CLAUDE.md): un orario risulta libero quando l'AI
 * lo propone, ma viene occupato da qualcun altro PRIMA che il cliente
 * confermi -- diverso dallo Scenario 3 (due richieste HTTP letteralmente
 * simultanee): qui la finestra di race è quella, molto più larga, tra due
 * turni separati della stessa conversazione.
 *
 * Simulato nel modo più deterministico e realistico: primo turno, il
 * cliente chiede solo se un orario è libero (senza nome/telefono, quindi
 * l'AI -- regola 3 del prompt -- non può ancora prenotare); PRIMA del
 * secondo turno, si inserisce direttamente (service_role, bypassando sia
 * l'AI sia la dashboard) un appuntamento confermato di un altro cliente
 * esattamente su quello slot; poi il cliente conferma dando nome e
 * telefono. `crea_prenotazione` deve fallire sul conflitto reale appena
 * creato (REGOLA ASSOLUTA 6: scusarsi e riproporre un'alternativa), non
 * sovrascrivere né duplicare l'appuntamento dell'altro cliente.
 */
test.describe("Scenario 8 -- lo slot si occupa durante la conversazione", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI non prenota su uno slot appena occupato e propone un'alternativa", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario8",
      piano: "growth",
      servizi: [{ nome: "Massaggio", durataMinuti: 45, prezzoCentesimi: 4000 }],
      operatori: [{ nome: "Diego", servizi: [0] }],
    });

    const giorno = prossimoGiornoAperto();
    const telefonoAltroCliente = "3339990080";
    const telefonoCliente = "3339990008";

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    await inviaMessaggioChat(page, `Ciao, è libero un Massaggio il ${giorno.etichettaGiornoMese} alle 11:00?`);

    // Tra il primo e il secondo turno, un altro cliente occupa DAVVERO
    // quello slot -- bypassando sia l'AI sia il form, come farebbe una
    // prenotazione arrivata nel frattempo da un altro canale (WhatsApp,
    // dashboard, un altro browser).
    const occupato = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "11:00",
      clienteNome: "Altro Cliente",
      clienteTelefono: telefonoAltroCliente,
    });

    let ultimaRisposta = await inviaMessaggioChat(
      page,
      `Sì perfetto, prenota alle 11:00. Mi chiamo Elena Costa, il mio numero è ${telefonoCliente}.`
    );

    async function clienteHaPrenotazione() {
      const { data } = await tenant.supabase
        .from("appuntamenti")
        .select("id, inizio")
        .eq("tenant_id", tenant.id)
        .neq("stato", "cancellato")
        .in(
          "cliente_id",
          (await tenant.supabase.from("clienti").select("id").eq("telefono", telefonoCliente)).data?.map((c) => c.id) ?? []
        );
      return data?.[0] ?? null;
    }

    // Come negli altri scenari con l'AI: fino a due turni in più per
    // arrivare a un'alternativa confermata, prima di arrendersi.
    let prenotazione = await clienteHaPrenotazione();
    let tentativi = 0;
    while (!prenotazione && tentativi < 2) {
      ultimaRisposta = await inviaMessaggioChat(page, "Va bene, prenota pure un altro orario libero quel giorno.");
      prenotazione = await clienteHaPrenotazione();
      tentativi++;
    }

    expect(
      prenotazione,
      `L'AI non ha proposto/confermato un'alternativa entro 3 turni dopo il conflitto. Ultima risposta: "${ultimaRisposta}"`
    ).toBeTruthy();
    expect(
      new Date(prenotazione!.inizio).getTime(),
      "l'alternativa proposta non deve coincidere con lo slot già occupato dall'altro cliente"
    ).not.toBe(occupato.inizio.getTime());

    // L'appuntamento dell'altro cliente deve restare intatto: mai
    // sovrascritto né duplicato da quello nuovo.
    const { data: rigaOccupata } = await tenant.supabase
      .from("appuntamenti")
      .select("id, stato, inizio")
      .eq("id", occupato.id)
      .single();
    expect(rigaOccupata?.stato).toBe("confermato");
    expect(new Date(rigaOccupata!.inizio).getTime()).toBe(occupato.inizio.getTime());
  });
});
