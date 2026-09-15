import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { PIANI_CON_PROMEMORIA_COMPLEANNO } from "@/lib/piani";
import {
  clientiDaAvvisarePerCompleanno,
  comporreMessaggioCompleanno,
  type ClientePerCompleanno,
  type DataCivile,
} from "@/lib/compleanno";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { escapeHtml } from "@/lib/email/notifiche.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";

type ClientAdmin = ReturnType<typeof creaClientAdmin>;

interface TenantConCompleanno {
  id: string;
  nome: string;
  piano: string;
  fuso_orario: string;
  compleanno_attivo: boolean;
  compleanno_messaggio: string | null;
}

/**
 * Promemoria di compleanno (Pro/Enterprise, vedi `pianoHaPromemoriaCompleanno`
 * in piani.ts e la logica pura in `src/lib/compleanno.ts`). File separato da
 * `promemoria.server.ts` invece di aggiungerci dentro: gate di piano
 * diverso (`PIANI_CON_PROMEMORIA_COMPLEANNO`, non `PIANI_CON_PROMEMORIA`),
 * un interruttore per tenant IN PIÙ da controllare (`compleanno_attivo`,
 * default spento) e un messaggio personalizzato invece del testo fisso
 * degli altri due promemoria -- stessa granularità "un file per
 * funzionalità con gate proprio" già seguita per tono-ai/knowledge-base
 * rispetto al resto dell'AI.
 *
 * Chiamato da `eseguiPromemoriaGiornalieri` (promemoria.server.ts), quindi
 * dallo stesso, unico cron giornaliero già esistente
 * (`/api/cron/promemoria`, vercel.json) -- niente nuovo cron da configurare
 * su Vercel per questa funzione.
 */
export async function avvisaCompleanni(admin: ClientAdmin, tenant: TenantConCompleanno, adesso: Date): Promise<number> {
  if (!tenant.compleanno_attivo) return 0; // interruttore spento: nessuna query, comportamento di default per chi non l'ha mai attivato

  const { data: clientiGrezzi } = await admin
    .from("clienti")
    .select("id, nome, email, telefono, data_nascita, compleanno_ultimo_anno_avvisato")
    .eq("tenant_id", tenant.id)
    .not("data_nascita", "is", null)
    .or("email.not.is.null,telefono.not.is.null");

  if (!clientiGrezzi || clientiGrezzi.length === 0) return 0;

  // Data civile LOCALE del tenant (vedi compleanno.ts per il perché), non
  // l'istante grezzo del cron -- stessa convenzione pseudo-UTC di tutto il
  // booking engine, letta qui con `realeAPseudoUtc` invece di richiederne
  // una nuova.
  const pseudoAdesso = realeAPseudoUtc(adesso, tenant.fuso_orario);
  const oggi: DataCivile = {
    anno: pseudoAdesso.getUTCFullYear(),
    mese: pseudoAdesso.getUTCMonth() + 1,
    giorno: pseudoAdesso.getUTCDate(),
  };

  interface ClienteEsteso extends ClientePerCompleanno {
    nomeOriginale: string | null;
  }
  const perId = new Map<string, ClienteEsteso>();
  for (const c of clientiGrezzi) {
    perId.set(c.id, {
      id: c.id,
      nome: c.nome,
      nomeOriginale: c.nome,
      email: c.email,
      telefono: c.telefono,
      dataNascita: c.data_nascita,
      tenantPiano: tenant.piano,
      ultimoAnnoAvvisato: c.compleanno_ultimo_anno_avvisato,
    });
  }

  const daAvvisare = clientiDaAvvisarePerCompleanno(
    [...perId.values()],
    { piano: tenant.piano, compleannoAttivo: tenant.compleanno_attivo },
    oggi
  );
  if (daAvvisare.length === 0) return 0;

  let inviati = 0;
  for (const ridotto of daAvvisare) {
    const cliente = perId.get(ridotto.id)!;

    // Claim-before-send annuale: stesso principio dell'update-condizionato
    // già usato per il follow-up clienti inattivi in promemoria.server.ts
    // (`promemoria_inattivita_inviato_at`) -- l'update tocca la riga SOLO
    // se non è già stata segnata per quest'anno, cosi' un secondo giro del
    // cron nello stesso giorno (o un run manuale ripetuto) non manda due
    // volte lo stesso augurio.
    const { data: aggiornato } = await admin
      .from("clienti")
      .update({ compleanno_ultimo_anno_avvisato: oggi.anno })
      .eq("id", cliente.id)
      .or(`compleanno_ultimo_anno_avvisato.is.null,compleanno_ultimo_anno_avvisato.neq.${oggi.anno}`)
      .select("id")
      .maybeSingle();
    if (!aggiornato) continue;

    const testo = comporreMessaggioCompleanno(tenant.compleanno_messaggio, cliente.nome);

    // Stesso principio email-o-SMS del resto del modulo promemoria: MAI
    // entrambi, SMS solo se il piano lo include (già garantito da
    // clientiDaAvvisarePerCompleanno, ricontrollato comunque da
    // inviaSmsSeInclusoNelPiano).
    let inviato: boolean;
    if (cliente.email) {
      inviato = await inviaEmail({
        a: cliente.email,
        oggetto: `Tanti auguri da ${tenant.nome}!`,
        nomeMittente: tenant.nome,
        html: `<p>${escapeHtml(testo)}</p>`,
      });
    } else if (cliente.telefono) {
      inviato = await inviaSmsSeInclusoNelPiano(admin, tenant.id, tenant.piano, cliente.telefono, testo);
    } else {
      inviato = false;
    }
    if (inviato) inviati += 1;
  }
  return inviati;
}

/** Colonne di `tenants` che servono a `avvisaCompleanni` -- esportato cosi'
 * `eseguiPromemoriaGiornalieri` puo' allargare la sua stessa select su
 * `tenants` con queste in più, invece di fare una seconda query per
 * tenant. */
export const COLONNE_TENANT_COMPLEANNO = "compleanno_attivo, compleanno_messaggio" as const;

/** Piani ammessi al promemoria di compleanno, per allargare il filtro
 * `.in("piano", ...)` di `eseguiPromemoriaGiornalieri` a chi ha ANCHE
 * (non SOLO) questo piano -- vedi uso in promemoria.server.ts. */
export const PIANI_PER_QUERY_COMPLEANNO = [...PIANI_CON_PROMEMORIA_COMPLEANNO];
