import { describe, expect, it, vi, beforeEach } from "vitest";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { cambiaSedeAttiva } from "./membri.server";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: vi.fn() }));

/**
 * La guardia di sicurezza del multi-sede (Fase 5, migrazione 0027).
 *
 * `cambiaSedeAttiva` riceve il tenant di destinazione da un form, quindi da
 * un valore scelto da chi invia la richiesta -- e scrive con il service_role,
 * che bypassa RLS. Sono le due condizioni che insieme fanno un buco: senza il
 * controllo di appartenenza, chiunque conosca (o indovini) l'id di un altro
 * salone potrebbe atterrarci dentro con pieni poteri, perché da quel momento
 * `auth_tenant_id()` restituirebbe quel tenant a ogni policy del database.
 *
 * Non è verificabile dallo Scenario 18 in Playwright: una server action non
 * si può invocare dall'esterno senza l'id generato dal bundler. Vive qui.
 */

interface RispostaFinta {
  data: unknown;
  error: { message: string } | null;
}

function creaAdminFinto(rispostaMembro: RispostaFinta) {
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  const from = vi.fn((tabella: string) => {
    if (tabella === "membri_tenant") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve(rispostaMembro) }),
          }),
        }),
      };
    }
    if (tabella === "profiles") {
      return { update };
    }
    throw new Error(`Tabella non prevista dal test: ${tabella}`);
  });

  return { client: { from }, update };
}

describe("cambiaSedeAttiva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rifiuta un tenant di cui l'utente NON è membro, e non scrive nulla", async () => {
    const { client, update } = creaAdminFinto({ data: null, error: null });
    vi.mocked(creaClientAdmin).mockReturnValue(client as never);

    const esito = await cambiaSedeAttiva("utente-1", "tenant-di-qualcun-altro");

    expect(esito).toEqual({ errore: "Non fai parte di questa attività." });
    expect(update, "nessuna scrittura su profiles se l'appartenenza non esiste").not.toHaveBeenCalled();
  });

  it("accetta un tenant di cui l'utente è membro e allinea anche il ruolo", async () => {
    // Lo stesso account può essere owner di un'attività e staff di un'altra:
    // il ruolo giusto è quello della sede in cui sta entrando, non quello che
    // aveva prima. Scriverlo qui è ciò che tiene onesti i gate di permesso,
    // che leggono `profiles.ruolo` a ogni richiesta.
    const { client, update } = creaAdminFinto({ data: { ruolo: "staff" }, error: null });
    vi.mocked(creaClientAdmin).mockReturnValue(client as never);

    const esito = await cambiaSedeAttiva("utente-1", "tenant-b");

    expect(esito).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ tenant_id: "tenant-b", ruolo: "staff" });
  });

  it("un errore di lettura non viene scambiato per 'non sei membro'", async () => {
    // Distinzione che conta: un database irraggiungibile deve dirlo, non far
    // credere a un titolare legittimo di non far parte della propria azienda.
    const { client, update } = creaAdminFinto({ data: null, error: { message: "boom" } });
    vi.mocked(creaClientAdmin).mockReturnValue(client as never);

    const esito = await cambiaSedeAttiva("utente-1", "tenant-b");

    expect(esito).toEqual({ errore: "Errore leggendo l'appartenenza: boom" });
    expect(update).not.toHaveBeenCalled();
  });
});
