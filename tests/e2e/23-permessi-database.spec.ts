import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY mancanti in .env.local");

    const client = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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

    // Ma l'agenda sì: è il suo lavoro, e se gliela bloccassimo il prodotto
    // sarebbe inutilizzabile per metà delle persone che ci lavorano.
    const { error: erroreCliente } = await come
      .from("clienti")
      .insert({ tenant_id: tenant.id, nome: "Cliente Dello Staff", telefono: "3331230023" });
    expect(erroreCliente, "un collaboratore deve poter creare un cliente").toBeNull();
  });
});
