import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { apriChat, inviaMessaggioChat } from "./helpers/chat";
import { prossimoGiornoAperto, secondoGiornoAperto } from "./helpers/date";
import { pseudoUtcAReale, FUSO_ORARIO_PREDEFINITO } from "@/lib/fuso-orario";

/**
 * Scenario 2 (punto 27 di CLAUDE.md): cliente esistente, con una
 * prenotazione già confermata, chiede in chat di spostarla -- l'AI deve
 * trovarla (`cerca_prenotazioni_cliente`, per telefono esatto) e aggiornarla
 * (`modifica_prenotazione`), passando dagli stessi controlli di
 * disponibilità di una prenotazione nuova.
 *
 * L'appuntamento di partenza è creato DIRETTAMENTE via service_role
 * (helper `creaAppuntamentoConfermato`), non con un primo giro di chat: qui
 * quello che serve al test è solo un dato di partenza noto, non un'altra
 * prova della creazione (già coperta dallo Scenario 1).
 */
test.describe("Scenario 2 -- cliente esistente modifica un appuntamento via chat", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("l'AI trova la prenotazione dal telefono e la sposta al nuovo giorno/ora richiesti", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario2",
      piano: "growth",
      servizi: [{ nome: "Massaggio", durataMinuti: 45, prezzoCentesimi: 4000 }],
      operatori: [{ nome: "Giulia", servizi: [0] }],
    });

    const telefono = "3339990002";
    const giorno1 = prossimoGiornoAperto();
    const giorno2 = secondoGiornoAperto();

    const appuntamentoOriginale = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno1.ymd,
      oraHHMM: "10:00",
      clienteNome: "Paolo Verdi",
      clienteTelefono: telefono,
    });

    await page.goto(`/s/${tenant.slug}`);
    await apriChat(page);
    let ultimaRisposta = await inviaMessaggioChat(
      page,
      `Ciao, vorrei spostare il mio appuntamento al ${giorno2.etichettaGiornoMese} alle 16:00. Il mio numero è ${telefono}.`
    );

    async function orarioAggiornato() {
      const { data } = await tenant.supabase
        .from("appuntamenti")
        .select("inizio")
        .eq("id", appuntamentoOriginale.id)
        .single();
      if (!data) return false;
      return new Date(data.inizio).getTime() !== appuntamentoOriginale.inizio.getTime();
    }

    // Come nello Scenario 1: l'AI potrebbe chiedere conferma prima di
    // spostare davvero -- fino a due turni in più prima di arrendersi.
    let spostato = await orarioAggiornato();
    let tentativi = 0;
    while (!spostato && tentativi < 2) {
      ultimaRisposta = await inviaMessaggioChat(page, "Sì, va bene, confermo lo spostamento.");
      spostato = await orarioAggiornato();
      tentativi++;
    }

    expect(spostato, `L'AI non ha spostato l'appuntamento entro 3 turni. Ultima risposta: "${ultimaRisposta}"`).toBe(true);

    // Ancora lo STESSO appuntamento (stesso id, mai una riga duplicata) --
    // e mai una seconda riga "confermato" per lo stesso cliente.
    const { data: righe } = await tenant.supabase
      .from("appuntamenti")
      .select("id, inizio, operatore_id, stato")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    expect(righe?.length, "deve restare UN solo appuntamento attivo, non uno spostato più uno nuovo").toBe(1);
    expect(righe![0].id).toBe(appuntamentoOriginale.id);

    // Il nuovo orario deve corrispondere a quanto chiesto: 16:00 civile del
    // giorno2 (stessa conversione usata dall'app per scrivere su `inizio`).
    const atteso = pseudoUtcAReale(new Date(Date.UTC(giorno2.data.getUTCFullYear(), giorno2.data.getUTCMonth(), giorno2.data.getUTCDate(), 16, 0)), FUSO_ORARIO_PREDEFINITO);
    expect(new Date(righe![0].inizio).getTime()).toBe(atteso.getTime());
  });
});
