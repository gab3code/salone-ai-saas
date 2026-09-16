import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { normalizzaRuolo, type RuoloAttivita } from "@/lib/ruoli";

/**
 * Appartenenze a un'attività: chi ci lavora, con quale ruolo, e come si passa
 * da un'attività all'altra (Fase 5, migrazione 0027).
 *
 * Perché TUTTO qui dentro passa dal client admin (service_role, che bypassa
 * RLS): `membri_tenant` e `inviti_membro` non hanno nessuna policy di
 * scrittura, di proposito. Se un utente autenticato potesse scriverci
 * direttamente, potrebbe aggiungersi a un'attività altrui o promuoversi da
 * staff a owner chiamando le API REST di Supabase senza passare dalla UI.
 * Il prezzo è che ogni funzione qui sotto DEVE verificare da sé chi sta
 * chiedendo: il `userId` che riceve arriva sempre da una sessione già
 * verificata (`ottieniSessioneTenant`), mai da un form.
 */

export type SedeDisponibile = {
  tenantId: string;
  nome: string;
  slug: string;
  ruolo: RuoloAttivita;
  attiva: boolean;
};

export type MembroAttivita = {
  userId: string;
  nome: string | null;
  email: string | null;
  ruolo: RuoloAttivita;
  daQuando: string;
};

export type InvitoPendente = {
  id: string;
  email: string;
  ruolo: RuoloAttivita;
  scadeIl: string;
};

export type InvitoRicevuto = {
  id: string;
  tenantId: string;
  nomeAttivita: string;
  ruolo: RuoloAttivita;
};

/**
 * Le attività a cui questo account può accedere, per il selettore di sede.
 * Serve il client admin anche solo per LEGGERE i nomi: la policy su `tenants`
 * (migrazione 0001) mostra soltanto la sede attiva, quindi con il client
 * dell'utente le altre sedi verrebbero fuori senza nome.
 */
export async function elencaSediUtente(
  userId: string,
  tenantAttivo: string | null
): Promise<SedeDisponibile[]> {
  const admin = creaClientAdmin();
  const { data, error } = await admin
    .from("membri_tenant")
    .select("tenant_id, ruolo, tenants ( nome, slug )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.flatMap((riga) => {
    const tenant = riga.tenants as unknown as { nome: string; slug: string } | null;
    if (!tenant) return [];
    return [
      {
        tenantId: riga.tenant_id as string,
        nome: tenant.nome,
        slug: tenant.slug,
        ruolo: normalizzaRuolo(riga.ruolo as string),
        attiva: riga.tenant_id === tenantAttivo,
      },
    ];
  });
}

/**
 * Cambia la sede attiva. L'appartenenza viene verificata QUI, non nella UI:
 * un `tenantId` arrivato da un form è un valore scelto da chi invia la
 * richiesta, quindi va trattato come non fidato.
 *
 * Aggiorna anche `profiles.ruolo`, perché lo stesso account può essere owner
 * di un'attività e staff di un'altra: il ruolo giusto è quello della sede in
 * cui sta entrando.
 */
export async function cambiaSedeAttiva(
  userId: string,
  tenantId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();

  const { data: membro, error } = await admin
    .from("membri_tenant")
    .select("ruolo")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return { errore: `Errore leggendo l'appartenenza: ${error.message}` };
  if (!membro) return { errore: "Non fai parte di questa attività." };

  const { error: erroreUpdate } = await admin
    .from("profiles")
    .update({ tenant_id: tenantId, ruolo: membro.ruolo })
    .eq("id", userId);

  if (erroreUpdate) return { errore: `Errore cambiando attività: ${erroreUpdate.message}` };
  return { ok: true };
}

/** Chi lavora in questa attività, per la schermata Team (solo owner). */
export async function elencaMembri(tenantId: string): Promise<MembroAttivita[]> {
  const admin = creaClientAdmin();

  const { data, error } = await admin
    .from("membri_tenant")
    .select("user_id, ruolo, created_at, profiles ( nome )")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  // L'email non sta in `profiles` ma in auth.users: si legge una volta sola
  // per l'elenco, non una chiamata per riga.
  const emailPerUtente = new Map<string, string | null>();
  const { data: utenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const utente of utenti?.users ?? []) {
    emailPerUtente.set(utente.id, utente.email ?? null);
  }

  return data.map((riga) => {
    const profilo = riga.profiles as unknown as { nome: string | null } | null;
    return {
      userId: riga.user_id as string,
      nome: profilo?.nome ?? null,
      email: emailPerUtente.get(riga.user_id as string) ?? null,
      ruolo: normalizzaRuolo(riga.ruolo as string),
      daQuando: riga.created_at as string,
    };
  });
}

export async function elencaInvitiPendenti(tenantId: string): Promise<InvitoPendente[]> {
  const admin = creaClientAdmin();
  const { data } = await admin
    .from("inviti_membro")
    .select("id, email, ruolo, scade_il")
    .eq("tenant_id", tenantId)
    .is("usato_il", null)
    .gt("scade_il", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (data ?? []).map((riga) => ({
    id: riga.id as string,
    email: riga.email as string,
    ruolo: normalizzaRuolo(riga.ruolo as string),
    scadeIl: riga.scade_il as string,
  }));
}

/**
 * Invita una persona nell'attività. Due strade possibili, gestite entrambe:
 *   - email senza account -> Supabase manda l'invito, e al momento della
 *     registrazione il trigger della migrazione 0027 la fa entrare
 *     direttamente qui dentro invece di crearle un'attività sua;
 *   - email che ha GIÀ un account -> Supabase rifiuta l'invito (l'utente
 *     esiste), ma la riga di invito resta valida e la persona se la trova in
 *     cima alla dashboard la prossima volta che entra, da accettare.
 * In entrambi i casi l'invito vive nel database, non nel link: revocarlo
 * cancella davvero l'accesso, anche se il messaggio email è già partito.
 */
export async function invitaMembro(
  tenantId: string,
  emailGrezza: string,
  ruolo: RuoloAttivita,
  creatoDa: string
): Promise<{ ok: true; giaRegistrato: boolean } | { errore: string }> {
  const email = emailGrezza.trim().toLowerCase();
  if (!email || !email.includes("@")) return { errore: "Inserisci un'email valida." };

  const admin = creaClientAdmin();

  const { data: giaMembro } = await admin
    .from("membri_tenant")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .limit(1000);

  const idMembri = new Set((giaMembro ?? []).map((r) => r.user_id as string));
  const { data: utenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const utenteEsistente = (utenti?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email
  );

  if (utenteEsistente && idMembri.has(utenteEsistente.id)) {
    return { errore: "Questa persona fa già parte dell'attività." };
  }

  const scadeIl = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("inviti_membro")
    .upsert(
      { tenant_id: tenantId, email, ruolo, creato_da: creatoDa, scade_il: scadeIl, usato_il: null },
      { onConflict: "tenant_id,email" }
    );

  if (error) {
    // L'indice unico è parziale (solo gli inviti non ancora usati), quindi
    // `onConflict` non sempre lo aggancia: in quel caso si riparte con un
    // insert pulito dopo aver chiuso l'invito precedente.
    await admin
      .from("inviti_membro")
      .update({ usato_il: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .is("usato_il", null);

    const { error: erroreInsert } = await admin
      .from("inviti_membro")
      .insert({ tenant_id: tenantId, email, ruolo, creato_da: creatoDa, scade_il: scadeIl });

    if (erroreInsert) return { errore: `Errore creando l'invito: ${erroreInsert.message}` };
  }

  if (utenteEsistente) return { ok: true, giaRegistrato: true };

  const { error: erroreInvito } = await admin.auth.admin.inviteUserByEmail(email);
  if (erroreInvito) {
    // L'invito nel database c'è comunque: la persona può registrarsi da sé
    // con quella email e il trigger la farà entrare lo stesso.
    return { ok: true, giaRegistrato: false };
  }

  return { ok: true, giaRegistrato: false };
}

export async function revocaInvito(
  tenantId: string,
  invitoId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();
  const { error } = await admin
    .from("inviti_membro")
    .update({ usato_il: new Date().toISOString() })
    .eq("id", invitoId)
    .eq("tenant_id", tenantId)
    .is("usato_il", null);

  if (error) return { errore: `Errore revocando l'invito: ${error.message}` };
  return { ok: true };
}

/** Gli inviti che aspettano QUESTO account, mostrati in cima alla dashboard. */
export async function elencaInvitiRicevuti(email: string | null): Promise<InvitoRicevuto[]> {
  if (!email) return [];
  const admin = creaClientAdmin();

  const { data } = await admin
    .from("inviti_membro")
    .select("id, tenant_id, ruolo, tenants ( nome )")
    .eq("email", email.toLowerCase())
    .is("usato_il", null)
    .gt("scade_il", new Date().toISOString());

  return (data ?? []).flatMap((riga) => {
    const tenant = riga.tenants as unknown as { nome: string } | null;
    if (!tenant) return [];
    return [
      {
        id: riga.id as string,
        tenantId: riga.tenant_id as string,
        nomeAttivita: tenant.nome,
        ruolo: normalizzaRuolo(riga.ruolo as string),
      },
    ];
  });
}

/**
 * Accetta un invito. L'email dell'invito deve combaciare con quella
 * dell'account che lo accetta: è l'unica cosa che impedisce di accettare
 * l'invito di qualcun altro conoscendone l'id.
 */
export async function accettaInvito(
  userId: string,
  emailUtente: string | null,
  invitoId: string
): Promise<{ ok: true; tenantId: string } | { errore: string }> {
  if (!emailUtente) return { errore: "Account senza email, impossibile accettare l'invito." };
  const admin = creaClientAdmin();

  const { data: invito } = await admin
    .from("inviti_membro")
    .select("id, tenant_id, email, ruolo, scade_il, usato_il")
    .eq("id", invitoId)
    .maybeSingle();

  if (!invito || invito.usato_il) return { errore: "Invito non più valido." };
  if (new Date(invito.scade_il as string).getTime() < Date.now()) {
    return { errore: "Invito scaduto." };
  }
  if ((invito.email as string).toLowerCase() !== emailUtente.toLowerCase()) {
    return { errore: "Questo invito è intestato a un'altra email." };
  }

  const { error } = await admin
    .from("membri_tenant")
    .upsert(
      { user_id: userId, tenant_id: invito.tenant_id, ruolo: invito.ruolo },
      { onConflict: "user_id,tenant_id" }
    );

  if (error) return { errore: `Errore entrando nell'attività: ${error.message}` };

  await admin
    .from("inviti_membro")
    .update({ usato_il: new Date().toISOString() })
    .eq("id", invitoId);

  return { ok: true, tenantId: invito.tenant_id as string };
}

/**
 * Cambia il ruolo di un membro. Non si può togliere l'ultimo owner: senza,
 * l'attività resterebbe senza nessuno che può gestire abbonamento e
 * configurazione, e nemmeno riassegnare i ruoli -- irrecuperabile dalla UI.
 */
export async function cambiaRuoloMembro(
  tenantId: string,
  userId: string,
  nuovoRuolo: RuoloAttivita
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();

  if (nuovoRuolo !== "owner") {
    const { count } = await admin
      .from("membri_tenant")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("ruolo", "owner");

    if ((count ?? 0) <= 1) {
      return { errore: "Deve restare almeno un titolare nell'attività." };
    }
  }

  const { error } = await admin
    .from("membri_tenant")
    .update({ ruolo: nuovoRuolo })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) return { errore: `Errore cambiando ruolo: ${error.message}` };

  // Se la persona sta lavorando proprio in questa sede, il ruolo che conta
  // per i permessi (profiles.ruolo) va allineato subito, non al prossimo
  // cambio sede.
  await admin
    .from("profiles")
    .update({ ruolo: nuovoRuolo })
    .eq("id", userId)
    .eq("tenant_id", tenantId);

  return { ok: true };
}

/**
 * Rimuove una persona dall'attività. Se quella era la sua sede attiva, la
 * sposta su un'altra attività di cui fa parte; se non ne ha altre, resta
 * senza sede attiva (`profiles.tenant_id` a null) e RLS le nega tutto -- vedi
 * la nota nella migrazione 0027.
 */
export async function rimuoviMembro(
  tenantId: string,
  userId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();

  const { data: membro } = await admin
    .from("membri_tenant")
    .select("ruolo")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membro) return { errore: "Questa persona non fa parte dell'attività." };

  if (normalizzaRuolo(membro.ruolo as string) === "owner") {
    const { count } = await admin
      .from("membri_tenant")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("ruolo", "owner");

    if ((count ?? 0) <= 1) {
      return { errore: "Deve restare almeno un titolare nell'attività." };
    }
  }

  const { error } = await admin
    .from("membri_tenant")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) return { errore: `Errore rimuovendo la persona: ${error.message}` };

  const { data: profilo } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profilo?.tenant_id === tenantId) {
    const { data: altra } = await admin
      .from("membri_tenant")
      .select("tenant_id, ruolo")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    await admin
      .from("profiles")
      .update({
        tenant_id: altra?.tenant_id ?? null,
        ruolo: altra ? altra.ruolo : "staff",
      })
      .eq("id", userId);
  }

  return { ok: true };
}
