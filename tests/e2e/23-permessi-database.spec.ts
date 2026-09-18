import { test, expect } from "@playwright/test";
import { type SupabaseClient } from "@supabase/supabase-js";
import { creaClientAnonimoTest } from "./helpers/supabase-admin";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaMembroDiProva, type MembroDiProva } from "./helpers/membri-di-prova";

/**
 * Scenario 23 (17/09/2026, migrazione 0030): i permessi reggono anche
 * saltando completamente l'applicazione.
 *
 * Tutti gli altri scenari passano dal browser, quindi verificano i controlli
 * che stanno nelle server action. Questo fa l'opposto apposta: si autentica
 * con la anon key -- che è pubblica per definizione, sta nel bundle che ogni
 * visitatore scarica -- e parla direttamente con PostgREST, come farebbe
 * chiunque aprisse la console del browser. È l'unico test che dimostra
 * qualcosa su ciò che il DATABASE permette, e non su ciò che permette il
 * nostro codice.
 *
 * Esiste perché fino al 17/09/2026 la risposta era "quasi tutto": una PATCH
 * su /rest/v1/tenants con {"piano":"enterprise","piano_manuale":true}
 * regalava a chiunque il piano più caro in modo permanente, e uno staff
 * poteva cancellare servizi e cambiare prezzi. Se un domani qualcuno
 * riscrivesse una policy o rimettesse un GRANT largo, nessun altro test se
 * ne accorgerebbe: fallirebbe solo questo.
 *
 * Nota sul metodo: si asserisce sempre sul VALORE dopo il tentativo, mai
 * solo sull'errore restituito. Una policy che non fa passare la riga non
 * produce un errore -- produce "0 righe aggiornate", che dal client sembra
 * un successo. È la differenza fra credere di essere protetti ed esserlo.
 */
test.describe("Scenario 23 -- i permessi valgono anche contro il database nudo", () => {
  let tenant: TenantDiProva;
  let staff: MembroDiProva | null = null;

  test.afterEach(async () => {
    await staff?.pulisci();
    staff = null;
    await tenant?.pulisci();
  });

  /** Un client con la stessa identità che avrebbe il browser di quell'utente. */
  async function clientComeUtente(email: string, password: string): Promise<SupabaseClient> {
    // Il database e' quello dei test, non quello di .env.local: vedi la nota
    // in helpers/supabase-admin.ts.
    const client = creaClientAnonimoTest();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Login diretto fallito: ${error.message}`);
    return client;
  }

  test("il titolare non può regalarsi un piano, né togliersi una sospensione", async () => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Permessi DB", piano: "free" });
    await tenant.supabase
      .from("tenants")
      .update({ sospesa: true, sospesa_motivo: "prova" })
      .eq("id", tenant.id);

    const come = await clientComeUtente(tenant.email, tenant.password);

    await come
      .from("tenants")
      .update({ piano: "enterprise", stato_abbonamento: "attivo", piano_manuale: true })
      .eq("id", tenant.id);
    await come.from("tenants").update({ sospesa: false }).eq("id", tenant.id);
    await come.from("tenants").update({ stripe_subscription_id: "sub_finto" }).eq("id", tenant.id);

    const { data } = await tenant.supabase
      .from("tenants")
      .select("piano, stato_abbonamento, piano_manuale, sospesa, stripe_subscription_id")
      .eq("id", tenant.id)
      .single();

    expect(data?.piano, "il piano non si cambia da fuori").toBe("free");
    expect(data?.piano_manuale, "piano_manuale renderebbe l'abuso permanente").toBe(false);
    expect(data?.sospesa, "una sospensione non si annulla da sé").toBe(true);
    expect(data?.stripe_subscription_id, "l'id abbonamento non si inventa").toBeNull();
  });

  test("il titolare può però modificare quello che è suo davvero", async () => {
    // Controprova indispensabile: senza, una migrazione che nega TUTTO
    // farebbe passare il test qui sopra a pieni voti, e il prodotto sarebbe
    // rotto senza che nessuno se ne accorga.
    tenant = await creaTenantDiProva({ nome: "Salone E2E Permessi DB Ok", piano: "free" });
    const come = await clientComeUtente(tenant.email, tenant.password);

    await come
      .from("tenants")
      .update({ descrizione: "Nuova descrizione", ore_minime_cancellazione: 48 })
      .eq("id", tenant.id);

    const { data } = await tenant.supabase
      .from("tenants")
      .select("descrizione, ore_minime_cancellazione")
      .eq("id", tenant.id)
      .single();
    expect(data?.descrizione).toBe("Nuova descrizione");
    expect(data?.ore_minime_cancellazione).toBe(48);
  });

  test("il collaboratore non tocca servizi e prezzi nemmeno dal database", async () => {
    tenant = await creaTenantDiProva({
      nome: "Salone E2E Permessi DB Staff",
      piano: "pro",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Operatrice", servizi: [0] }],
    });
    staff = await creaMembroDiProva(tenant.id, "staff");

    const come = await clientComeUtente(staff.email, staff.password);
    const servizio = tenant.servizi[0];

    await come.from("servizi").update({ prezzo_centesimi: 100 }).eq("id", servizio.id);
    await come.from("servizi").delete().eq("id", servizio.id);
    await come.from("operatori").delete().eq("id", tenant.operatori[0].id);

    const { data: servizioDopo } = await tenant.supabase
      .from("servizi")
      .select("prezzo_centesimi")
      .eq("id", servizio.id)
      .maybeSingle();
    expect(servizioDopo, "il servizio non deve essere stato cancellato").toBeTruthy();
    expect(servizioDopo?.prezzo_centesimi, "il prezzo non si cambia da uno staff").toBe(2000);

    const { count } = await tenant.supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    expect(count ?? 0, "nemmeno gli operatori si cancellano").toBe(1);

    // Fino alla migrazione 0051 qui c'era la controprova opposta: "un
    // collaboratore deve poter creare un cliente", perché l'agenda è il suo
    // lavoro. Resta vero nel prodotto -- ma non più da PostgREST: la rubrica
    // ora si tocca solo dal server (vedi il test in fondo a questo file, e
    // src/lib/clienti.server.ts). Che lo staff possa comunque lavorare con i
    // clienti lo dimostrano gli scenari che passano dal browser, 12 e 24.
    const { error: erroreCliente } = await come
      .from("clienti")
      .insert({ tenant_id: tenant.id, nome: "Cliente Dello Staff", telefono: "3331230023" });
    expect(erroreCliente, "la rubrica non si scrive più con la chiave pubblica").not.toBeNull();
  });

  /**
   * Migrazione 0051. La falla più vecchia rimasta aperta: uno staff vede i
   * clienti dentro il prodotto -- gli servono -- e con la stessa chiave
   * poteva chiedere l'intera rubrica a PostgREST e portarsela via in un
   * file. L'interfaccia riserva l'export CSV al titolare; PostgREST
   * l'interfaccia non la conosce.
   *
   * Non era chiudibile con una policy: "può leggere le righe del suo tenant"
   * e "può scaricarle tutte" sono la stessa query. L'unica chiusura possibile
   * era togliere il permesso e far passare ogni accesso dal server
   * (src/lib/clienti.server.ts).
   *
   * Vale anche per il TITOLARE, ed è voluto: se la lettura restasse concessa
   * a lui, basterebbe un invito accettato per rientrare dalla finestra.
   * Quello che il titolare può fare in più (esportare, cancellare) continua
   * a valere, ma passando dal prodotto -- scenari 20 e 24.
   *
   * SE QUESTO TEST FALLISCE e gli altri passano, quasi certamente la
   * migrazione 0051 non è stata applicata al progetto Supabase.
   */
  test("la rubrica non si legge né si scrive da PostgREST, nemmeno dal titolare", async () => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Rubrica Chiusa", piano: "pro" });
    staff = await creaMembroDiProva(tenant.id, "staff");

    const { data: cliente } = await tenant.supabase
      .from("clienti")
      .insert({ tenant_id: tenant.id, nome: "Cliente Riservato", telefono: "3331230051" })
      .select("id")
      .single();
    expect(cliente?.id, "il cliente di partenza deve esistere").toBeTruthy();

    for (const [chi, credenziali] of [
      ["il collaboratore", { email: staff.email, password: staff.password }],
      ["il titolare", { email: tenant.email, password: tenant.password }],
    ] as const) {
      const come = await clientComeUtente(credenziali.email, credenziali.password);

      // Il punto della migrazione: la LETTURA. Si asserisce sulle righe
      // tornate, non solo sull'errore -- un permesso mancante può anche
      // presentarsi come "zero righe", e zero righe è comunque una rubrica
      // non scaricata.
      const { data: letti } = await come.from("clienti").select("id, nome, telefono").eq("tenant_id", tenant.id);
      expect(letti ?? [], `${chi} non deve poter scaricare la rubrica`).toEqual([]);

      await come.from("clienti").insert({ tenant_id: tenant.id, nome: "Intruso", telefono: "3339990051" });
      await come.from("clienti").update({ nome: "Cambiato" }).eq("id", cliente!.id);
      await come.from("clienti").delete().eq("id", cliente!.id);
    }

    // Controprova sullo STATO, non sugli errori restituiti: niente creato,
    // niente cambiato, niente cancellato.
    const { data: rimasti } = await tenant.supabase
      .from("clienti")
      .select("id, nome")
      .eq("tenant_id", tenant.id);
    expect(rimasti ?? [], "nessuna delle scritture tentate deve aver lasciato traccia").toEqual([
      { id: cliente!.id, nome: "Cliente Riservato" },
    ]);
  });

  /**
   * Qui stava il test della migrazione 0035 (cancellazione cliente
   * owner-only contro il database nudo): uno staff non doveva poter
   * cancellare via PostgREST, il titolare sì.
   *
   * La 0051 lo ha superato per intero: da PostgREST non cancella più
   * nessuno, titolare compreso, ed è il test qui sopra a dimostrarlo. La
   * policy `cancellazione_owner` resta scritta nel database -- se un domani
   * si riconcedessero i permessi tornerebbe a valere -- ma non è più lei a
   * tenere il confine. Quel confine oggi lo tiene `richiediPermesso` nella
   * server action, ed è verificato dallo scenario 24, che passa dal browser
   * e prova anche a chiamare l'azione a mano da un account staff.
   */
});
