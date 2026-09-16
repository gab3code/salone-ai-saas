import { creaClientAdminTest } from "./supabase-admin";

/**
 * Secondo account collegato a un tenant di prova (Fase 5, migrazione 0027) --
 * serve agli scenari 18 (multi-sede) e 19 (permessi staff).
 *
 * Scrive sia `membri_tenant` (l'appartenenza vera) sia `profiles`
 * (`tenant_id` = sede attiva, `ruolo` = ruolo in quella sede), esattamente
 * come fa il trigger `gestisci_nuovo_utente` quando qualcuno entra da un
 * invito: se si scrivesse solo una delle due, la sessione risulterebbe
 * incoerente e il test verificherebbe uno stato che in produzione non esiste.
 */
export interface MembroDiProva {
  utenteId: string;
  email: string;
  password: string;
  pulisci(): Promise<void>;
}

export async function creaMembroDiProva(
  tenantId: string,
  ruolo: "owner" | "staff"
): Promise<MembroDiProva> {
  const supabase = creaClientAdminTest();
  const suffisso = Math.random().toString(36).slice(2, 10);
  const email = `e2e-membro-${suffisso}@example.com`;
  const password = `TestE2E-${suffisso}!`;

  // Nota: creando l'utente scatta comunque il trigger, che gli crea
  // un'attività tutta sua (non c'è nessun invito pendente per questa email).
  // È esattamente ciò che succede a chi si registra da solo, e serve saperlo
  // per la pulizia: sotto va cancellato anche quel tenant "di scarto".
  const { data: creato, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_persona: `Membro Test ${suffisso}` },
  });
  if (error || !creato?.user) {
    throw new Error(`Impossibile creare il membro di prova: ${error?.message}`);
  }
  const utenteId = creato.user.id;

  const { data: profiloIniziale } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", utenteId)
    .single();
  const tenantDiScarto = profiloIniziale?.tenant_id as string | null;

  const { error: erroreMembro } = await supabase
    .from("membri_tenant")
    .upsert({ user_id: utenteId, tenant_id: tenantId, ruolo }, { onConflict: "user_id,tenant_id" });
  if (erroreMembro) {
    throw new Error(`Impossibile collegare il membro al tenant: ${erroreMembro.message}`);
  }

  // Sede attiva + ruolo: è quello che legge `ottieniSessioneTenant`.
  const { error: erroreProfilo } = await supabase
    .from("profiles")
    .update({ tenant_id: tenantId, ruolo })
    .eq("id", utenteId);
  if (erroreProfilo) {
    throw new Error(`Impossibile impostare la sede attiva del membro: ${erroreProfilo.message}`);
  }

  // L'attività "di scarto" creata dal trigger va tolta SUBITO, non alla
  // pulizia finale: finché esiste, questa persona risulta membro di DUE
  // attività e la dashboard le mostra il selettore di sede -- uno stato che
  // in produzione non ha, e che falsa gli scenari (visto dal vivo il
  // 16/09/2026: lo Scenario 19 trovava due elementi con scritto
  // "collaboratore", uno dei quali era un'opzione del selettore).
  // A questo punto `profiles.tenant_id` punta già al tenant vero, quindi la
  // cancellazione non tocca il profilo (foreign key `set null`, migrazione
  // 0029) e si porta via a cascata orari e regole promemoria.
  if (tenantDiScarto && tenantDiScarto !== tenantId) {
    await supabase.from("tenants").delete().eq("id", tenantDiScarto);
  }

  async function pulisci() {
    // `membri_tenant` sparisce da sé (on delete cascade su auth.users).
    await supabase.auth.admin.deleteUser(utenteId);
  }

  return { utenteId, email, password, pulisci };
}

/**
 * Collega un utente GIÀ esistente a un secondo tenant, senza toccarne la
 * sede attiva -- è la situazione del multi-sede: un titolare che possiede due
 * attività e ci passa in mezzo dal selettore.
 */
export async function collegaUtenteATenant(
  utenteId: string,
  tenantId: string,
  ruolo: "owner" | "staff"
): Promise<void> {
  const supabase = creaClientAdminTest();
  const { error } = await supabase
    .from("membri_tenant")
    .upsert({ user_id: utenteId, tenant_id: tenantId, ruolo }, { onConflict: "user_id,tenant_id" });
  if (error) throw new Error(`Impossibile collegare l'utente al secondo tenant: ${error.message}`);
}
