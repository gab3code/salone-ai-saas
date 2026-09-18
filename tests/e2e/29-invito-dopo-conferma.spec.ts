import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaClientAdminTest } from "./helpers/supabase-admin";

/**
 * Scenario 29 (18/09/2026): un invito si consuma solo DOPO la conferma
 * dell'email.
 *
 * Prima, il trigger collegava l'utente al tenant che lo aveva invitato gia'
 * alla registrazione. Se la conferma email fosse disattivata sul progetto
 * Supabase -- un'impostazione che vive fuori dal codice -- chi indovina
 * l'indirizzo invitato, tipicamente info@ qualcosa, entrerebbe nell'attivita'
 * di un altro salone con il ruolo che l'invito gli assegna.
 *
 * Questo test non guarda lo schermo: guarda il database. E' l'unico modo di
 * verificare un trigger, e ieri notte e' stato un test cosi' a trovare un bug
 * che l'interfaccia nascondeva.
 *
 * Non chiama il modello e non manda email: costa zero.
 */

test.describe("Scenario 29 -- l'invito aspetta la conferma dell'email", () => {
  let tenant: TenantDiProva;
  const daPulire: string[] = [];

  test.afterEach(async () => {
    const supabase = creaClientAdminTest();
    for (const id of daPulire) {
      await supabase.auth.admin.deleteUser(id).catch(() => {});
    }
    daPulire.length = 0;
    if (tenant) await tenant.pulisci();
  });

  test("senza conferma non entra, dopo la conferma entra con il ruolo giusto", async () => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E S29", piano: "growth" });
    const supabase = creaClientAdminTest();
    const suffisso = Math.random().toString(36).slice(2, 10);
    const email = `e2e-invitato-${suffisso}@example.com`;

    const { data: invito } = await supabase
      .from("inviti_membro")
      .insert({ tenant_id: tenant.id, email, ruolo: "staff" })
      .select("id")
      .single();
    expect(invito, "l'invito di prova deve esistere").toBeTruthy();

    // --- registrazione SENZA conferma ---------------------------------
    const { data: creato, error } = await supabase.auth.admin.createUser({
      email,
      password: `TestE2E-${suffisso}!`,
      email_confirm: false,
    });
    expect(error, "l'utente di prova deve nascere").toBeNull();
    const utenteId = creato!.user!.id;
    daPulire.push(utenteId);

    const { data: profiloPrima } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", utenteId)
      .maybeSingle();
    expect(
      profiloPrima,
      "senza conferma dell'email non deve esistere nessun profilo: e' il buco che questo scenario chiude"
    ).toBeNull();

    const { data: membriPrima } = await supabase
      .from("membri_tenant")
      .select("user_id")
      .eq("user_id", utenteId);
    expect(membriPrima ?? [], "e nemmeno un'appartenenza all'attivita' altrui").toHaveLength(0);

    const { data: invitoPrima } = await supabase
      .from("inviti_membro")
      .select("usato_il")
      .eq("id", invito!.id)
      .single();
    expect(
      invitoPrima?.usato_il,
      "l'invito deve restare valido: consumarlo qui lo brucerebbe per chi ha diritto di usarlo"
    ).toBeNull();

    // --- arriva la conferma -------------------------------------------
    const { error: erroreConferma } = await supabase.auth.admin.updateUserById(utenteId, {
      email_confirm: true,
    });
    expect(erroreConferma).toBeNull();

    const { data: profiloDopo } = await supabase
      .from("profiles")
      .select("tenant_id, ruolo")
      .eq("id", utenteId)
      .maybeSingle();
    expect(profiloDopo?.tenant_id, "dopo la conferma entra nel tenant che lo ha invitato").toBe(
      tenant.id
    );
    expect(profiloDopo?.ruolo, "con il ruolo scritto nell'invito, non owner").toBe("staff");

    const { data: membroDopo } = await supabase
      .from("membri_tenant")
      .select("tenant_id, ruolo")
      .eq("user_id", utenteId)
      .maybeSingle();
    expect(membroDopo?.tenant_id).toBe(tenant.id);
    expect(membroDopo?.ruolo).toBe("staff");

    const { data: invitoDopo } = await supabase
      .from("inviti_membro")
      .select("usato_il")
      .eq("id", invito!.id)
      .single();
    expect(invitoDopo?.usato_il, "e solo adesso l'invito risulta usato").toBeTruthy();
  });

  test("chi NON ha un invito continua ad avere la sua attivita', come prima", async () => {
    const supabase = creaClientAdminTest();
    const suffisso = Math.random().toString(36).slice(2, 10);

    const { data: creato } = await supabase.auth.admin.createUser({
      email: `e2e-titolare-${suffisso}@example.com`,
      password: `TestE2E-${suffisso}!`,
      email_confirm: true,
      user_metadata: { nome_salone: "Salone Senza Invito" },
    });
    const utenteId = creato!.user!.id;
    daPulire.push(utenteId);

    const { data: profilo } = await supabase
      .from("profiles")
      .select("tenant_id, ruolo")
      .eq("id", utenteId)
      .maybeSingle();
    expect(profilo?.tenant_id, "deve avere un'attivita' tutta sua").toBeTruthy();
    expect(profilo?.ruolo).toBe("owner");

    if (profilo?.tenant_id) {
      const { data: t } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", profilo.tenant_id)
        .single();
      expect(t?.nome).toBe("Salone Senza Invito");
      await supabase.from("tenants").delete().eq("id", profilo.tenant_id);
    }
  });
});
