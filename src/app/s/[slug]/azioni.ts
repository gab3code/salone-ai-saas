"use server";

import { headers } from "next/headers";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { risolviTenantIdDaSlug } from "@/lib/ai/tools";
import {
  trovaSlotEStatoGiornoTenant,
  creaAppuntamentoTenant,
  verificaConflittoTenant,
  parsaOrarioLocale,
  aggiungiListaAttesaTenant,
} from "@/lib/booking-engine.server";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { creaClientStripe } from "@/lib/stripe/server";
import { calcolaImportoCaparraCentesimi, type ConfigCaparra } from "@/lib/stripe/caparra";
import { campoTrappolaCompilato, formPubblicoCompilatoTroppoVeloce } from "@/lib/anti-bot";

/**
 * Server action pubbliche di prenotazione (Fase 4, punto 15) -- chiamate dal
 * componente client del flusso di prenotazione sulla pagina `/s/[slug]`, MAI
 * autenticate: chi le chiama è un visitatore anonimo del sito. Stesso
 * ragionamento di sicurezza di `/api/chat/[slug]`:
 *
 * - Si riceve sempre lo `slug`, MAI un `tenantId` dal client -- risolto qui
 *   dentro con `risolviTenantIdDaSlug` (client admin), così un payload
 *   manomesso non può mai far scrivere/leggere un altro salone.
 * - `creaAppuntamentoTenant` è la STESSA funzione di scrittura usata dalla
 *   dashboard e dai tool dell'AI (punto 9 di CLAUDE.md: unica fonte di
 *   verità) -- qui passiamo solo `creatoDa: "pubblico"` per distinguere il
 *   canale nello storico cliente (vedi dashboard/clienti/[id]/page.tsx).
 * - Le stesse due difese anti-conflitto (controllo applicativo + vincolo
 *   Postgres) e il tetto di prenotazioni mensili Free si applicano quindi
 *   automaticamente anche qui, senza bisogno di duplicarli.
 *
 * ANTI-ABUSO (Gruppo D punto 1 di PIANO.md, aggiunto 13/09/2026, rivisto
 * 14/09/2026): tre livelli, dal più economico/sicuro al più drastico.
 * 1) Campo trappola + tempo minimo di compilazione (`src/lib/anti-bot.ts`),
 *    controllati qui per primi, PRIMA di qualunque query: zero rischio di
 *    falso positivo su un cliente vero, quindi filtrano la maggior parte
 *    dei bot senza mai poter respingere una prenotazione legittima.
 * 2) Anti-burst per telefono (stesso numero, stesso tenant, non due volte a
 *    meno di 20s) in `creaAppuntamentoTenant`.
 * 3) Tetto di volume per tenant (vedi booking-engine.server.ts) come ultima
 *    rete di sicurezza contro un attacco vero, tenuto volutamente alto
 *    proprio perché i livelli 1-2 già fermano i bot più comuni -- non deve
 *    diventare lui a bloccare un salone durante un picco di richieste vere.
 * Non ancora inclusa una vera conferma SMS/WhatsApp del numero (richiederebbe
 * un provider SMS a pagamento, nessuno integrato oggi).
 */

const FORMATO_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;
// E.164-ish, permissivo: cifre, spazi, +() - purché almeno 6 cifre in tutto --
// stessa tolleranza già implicita nella colonna `telefono` (testo libero, la
// chiave di riconoscimento cliente WhatsApp/chat è comunque il testo esatto).
const FORMATO_TELEFONO = /^[0-9+()\-\s]{6,30}$/;
// Permissivo di proposito (nessuna validazione RFC completa): serve solo a
// scartare refusi grossolani prima di provare a inviare un'email -- un
// formato valido ma inesistente fallirà comunque lato Mailjet, fail-open
// (vedi src/lib/email/mailjet.server.ts), senza mai bloccare la prenotazione.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SlotPubblico {
  operatoreId: string;
  inizioIso: string; // ISO "pseudo-UTC" (vedi src/lib/fuso-orario.ts) -- da mostrare così com'è, mai riconvertito lato client
}

export type RisultatoAzionePubblica<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; errore: string };

/**
 * Cerca gli slot liberi di un giorno per un servizio, per la pagina
 * pubblica. Ritorna anche `giornoChiuso` (bug UX segnalato da Gabriel il
 * 14/09/2026): senza questo campo, il componente non può distinguere "il
 * salone è chiuso questo giorno" (la lista d'attesa non ha senso, nessuno
 * slot si libererà mai lì) da "il salone è aperto ma è pieno" (la lista
 * d'attesa ha senso, una cancellazione può liberare un posto) -- prima
 * entrambi i casi arrivavano qui come lo stesso `slot: []`.
 */
export async function cercaSlotPubblici(
  slug: string,
  servizioId: string,
  dataYMD: string
): Promise<RisultatoAzionePubblica<{ slot: SlotPubblico[]; giornoChiuso: boolean }>> {
  if (!servizioId || !FORMATO_DATA_YMD.test(dataYMD)) {
    return { ok: false, errore: "Richiesta non valida." };
  }

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);

  const { slot: slotGrezzi, giornoChiuso } = await trovaSlotEStatoGiornoTenant(supabase, tenantId, {
    data: new Date(`${dataYMD}T00:00:00Z`),
    servizioIds: [servizioId],
  });

  // Il motore puro non conosce "adesso" (calcola solo apertura meno
  // occupato): per un cliente che prenota da solo, mai proporre uno slot
  // già passato se il giorno scelto è oggi. Confronto nella stessa
  // convenzione pseudo-UTC di `slot.inizio` -- vedi fuso-orario.ts.
  const adessoPseudo = realeAPseudoUtc(new Date(), fusoOrario);
  const slot = slotGrezzi
    .filter((s) => s.inizio.getTime() > adessoPseudo.getTime())
    .map((s) => ({ operatoreId: s.operatoreId, inizioIso: s.inizio.toISOString() }));

  return { ok: true, slot, giornoChiuso };
}

export interface DatiPrenotazionePubblica {
  servizioId: string;
  operatoreId: string;
  inizioIso: string; // uno degli `inizioIso` restituiti da cercaSlotPubblici, invariato
  clienteNome: string;
  clienteTelefono: string;
  // Opzionale (Fase 6, Gruppo B-bis #1): se presente abilita l'email di
  // conferma al cliente, vedi src/lib/email/notifiche.server.ts.
  clienteEmail?: string;
  // Anti-bot silenzioso (vedi src/lib/anti-bot.ts): entrambi opzionali e mai
  // popolati da un cliente reale, solo dal componente client.
  trappola?: string;
  iniziatoAlleMs?: number;
}

/**
 * Carica configurazione caparra del tenant + prezzo del servizio scelto, e
 * calcola l'importo -- usata sia dalla guardia in `prenotaPubblico` sia da
 * `avviaPagamentoCaparra`, un solo punto che legge queste due righe invece
 * di duplicarlo.
 */
async function caricaImportoCaparra(
  supabase: ReturnType<typeof creaClientAdmin>,
  tenantId: string,
  servizioId: string
): Promise<number> {
  const [tenantRes, servizioRes] = await Promise.all([
    supabase.from("tenants").select("caparra_attiva, caparra_tipo, caparra_valore").eq("id", tenantId).single(),
    supabase.from("servizi").select("prezzo_centesimi").eq("id", servizioId).eq("tenant_id", tenantId).single(),
  ]);
  if (!tenantRes.data || !servizioRes.data) return 0;

  const config: ConfigCaparra = {
    attiva: tenantRes.data.caparra_attiva,
    tipo: tenantRes.data.caparra_tipo,
    valore: tenantRes.data.caparra_valore,
  };
  return calcolaImportoCaparraCentesimi(config, servizioRes.data.prezzo_centesimi);
}

/**
 * Crea la prenotazione scelta dal cliente sulla pagina pubblica -- SOLO per
 * i tenant che non richiedono una caparra. Se il tenant la richiede per
 * questo servizio, rifiuta e indirizza al flusso di pagamento
 * (`avviaPagamentoCaparra`): altrimenti un client malevolo potrebbe chiamare
 * direttamente questa azione bypassando il pagamento richiesto.
 */
export async function prenotaPubblico(
  slug: string,
  dati: DatiPrenotazionePubblica
): Promise<RisultatoAzionePubblica<{ appuntamentoId: string }>> {
  // Anti-bot silenzioso, controllato per primo (vedi src/lib/anti-bot.ts e il
  // docblock in cima al file): un bot beccato dal campo trappola riceve una
  // finta conferma, senza scrivere nulla -- non gli si dà mai conferma di
  // essere stato scoperto.
  if (campoTrappolaCompilato(dati.trappola)) {
    return { ok: true, appuntamentoId: "00000000-0000-0000-0000-000000000000" };
  }
  if (formPubblicoCompilatoTroppoVeloce(dati.iniziatoAlleMs)) {
    return { ok: false, errore: "Richiesta non valida, riprova." };
  }

  const clienteNome = dati.clienteNome.trim().slice(0, 200);
  const clienteTelefono = dati.clienteTelefono.trim();
  const clienteEmail = dati.clienteEmail?.trim().slice(0, 200) || undefined;

  if (!dati.servizioId || !dati.operatoreId || !dati.inizioIso) {
    return { ok: false, errore: "Scegli servizio, operatore e orario." };
  }
  if (!clienteNome) return { ok: false, errore: "Inserisci il tuo nome." };
  if (!FORMATO_TELEFONO.test(clienteTelefono)) {
    return { ok: false, errore: "Inserisci un numero di telefono valido." };
  }
  if (clienteEmail && !FORMATO_EMAIL.test(clienteEmail)) {
    return { ok: false, errore: "Inserisci un'email valida, o lascia il campo vuoto." };
  }

  // Validazione rigida dell'orario con lo stesso parser usato ovunque nel
  // booking engine -- non ci si fida di un `new Date(stringa)` diretto su un
  // valore arrivato dal client, anche se qui dovrebbe sempre essere un
  // `inizioIso` restituito invariato da `cercaSlotPubblici`.
  const inizio = parsaOrarioLocale(dati.inizioIso);
  if (!inizio) return { ok: false, errore: "Orario non valido, riprova la ricerca." };

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const importoCaparra = await caricaImportoCaparra(supabase, tenantId, dati.servizioId);
  if (importoCaparra > 0) {
    return {
      ok: false,
      errore: "Questa attività richiede il pagamento di una caparra per confermare la prenotazione.",
    };
  }

  const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
    operatoreId: dati.operatoreId,
    servizioId: dati.servizioId,
    inizio,
    clienteNome,
    clienteTelefono,
    clienteEmail,
    creatoDa: "pubblico",
  });

  if (!risultato.ok) return { ok: false, errore: risultato.errore };
  return { ok: true, appuntamentoId: risultato.appuntamentoId };
}

/**
 * Avvia il pagamento della caparra per la prenotazione scelta: crea una
 * riga in `richieste_caparra` (stato "in_attesa") + una Stripe Checkout
 * Session in modalità "payment" (un pagamento singolo, non un abbonamento --
 * diverso da /api/stripe/checkout/route.ts, che crea sempre "subscription").
 * L'appuntamento vero e proprio NON viene creato qui: solo quando il webhook
 * riceve la conferma di pagamento (vedi commento in 0011_deposito_caparra.sql
 * sul perché e sul limite onestamente segnalato).
 *
 * Ritorna l'URL della pagina di pagamento ospitata da Stripe: il componente
 * client fa `window.location.href = checkoutUrl`, stesso pattern già usato
 * per il checkout degli abbonamenti (vedi Prezzi.tsx).
 */
export async function avviaPagamentoCaparra(
  slug: string,
  dati: DatiPrenotazionePubblica
): Promise<RisultatoAzionePubblica<{ checkoutUrl: string }>> {
  // Stesso anti-bot silenzioso di prenotaPubblico -- qui senza finta
  // conferma (non si può fingere un `checkoutUrl` Stripe reale), un errore
  // generico basta: un bot non arriva comunque quasi mai a questo punto.
  if (campoTrappolaCompilato(dati.trappola) || formPubblicoCompilatoTroppoVeloce(dati.iniziatoAlleMs)) {
    return { ok: false, errore: "Richiesta non valida, riprova." };
  }

  const clienteNome = dati.clienteNome.trim().slice(0, 200);
  const clienteTelefono = dati.clienteTelefono.trim();
  const clienteEmail = dati.clienteEmail?.trim().slice(0, 200) || undefined;

  if (!dati.servizioId || !dati.operatoreId || !dati.inizioIso) {
    return { ok: false, errore: "Scegli servizio, operatore e orario." };
  }
  if (!clienteNome) return { ok: false, errore: "Inserisci il tuo nome." };
  if (!FORMATO_TELEFONO.test(clienteTelefono)) {
    return { ok: false, errore: "Inserisci un numero di telefono valido." };
  }
  if (clienteEmail && !FORMATO_EMAIL.test(clienteEmail)) {
    return { ok: false, errore: "Inserisci un'email valida, o lascia il campo vuoto." };
  }

  const inizio = parsaOrarioLocale(dati.inizioIso);
  if (!inizio) return { ok: false, errore: "Orario non valido, riprova la ricerca." };

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const [tenantRes, servizioRes] = await Promise.all([
    supabase.from("tenants").select("nome, caparra_attiva, caparra_tipo, caparra_valore").eq("id", tenantId).single(),
    supabase.from("servizi").select("nome, prezzo_centesimi").eq("id", dati.servizioId).eq("tenant_id", tenantId).single(),
  ]);
  if (!tenantRes.data) return { ok: false, errore: "Attività non trovata." };
  if (!servizioRes.data) return { ok: false, errore: "Servizio non trovato." };

  const config: ConfigCaparra = {
    attiva: tenantRes.data.caparra_attiva,
    tipo: tenantRes.data.caparra_tipo,
    valore: tenantRes.data.caparra_valore,
  };
  const importoCentesimi = calcolaImportoCaparraCentesimi(config, servizioRes.data.prezzo_centesimi);
  if (importoCentesimi <= 0) {
    return {
      ok: false,
      errore: "Nessuna caparra richiesta per questa prenotazione: usa la conferma diretta.",
    };
  }

  // Doppio controllo di conflitto PRIMA di far pagare: non è la difesa
  // finale (lo slot non resta bloccato durante il pagamento, vedi la nota
  // nella migrazione), ma evita di far pagare qualcuno per uno slot già
  // occupato nel caso più comune e prevedibile.
  const { data: servizioDurata } = await supabase
    .from("servizi")
    .select("durata_minuti")
    .eq("id", dati.servizioId)
    .single();
  if (servizioDurata) {
    const fine = new Date(inizio.getTime() + servizioDurata.durata_minuti * 60_000);
    const conflitto = await verificaConflittoTenant(supabase, tenantId, {
      inizio,
      fine,
      operatoreId: dati.operatoreId,
    });
    if (conflitto) {
      return {
        ok: false,
        errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot.",
      };
    }
  }

  const intestazioni = await headers();
  const proto = intestazioni.get("x-forwarded-proto") ?? "https";
  const host = intestazioni.get("host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : null);
  if (!origin) return { ok: false, errore: "Impossibile determinare l'indirizzo del sito, riprova." };

  const stripe = creaClientStripe();

  // Sessione creata PRIMA della riga in richieste_caparra perché serve il
  // suo id come chiave univoca della riga -- l'ordine inverso (riga prima,
  // poi sessione con l'id della riga nei metadata) funzionerebbe anche, ma
  // qui è la Checkout Session stessa la chiave che il webhook userà per
  // ritrovare la riga (`stripe_checkout_session_id`).
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Caparra -- ${servizioRes.data.nome} da ${tenantRes.data.nome}`,
          },
          unit_amount: importoCentesimi,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/s/${slug}?caparra=successo#prenota`,
    cancel_url: `${origin}/s/${slug}?caparra=annullata#prenota`,
    metadata: { tipo: "caparra", tenant_id: tenantId },
  });
  if (!session.url) return { ok: false, errore: "Stripe non ha restituito un URL di pagamento." };

  const { error: erroreInsert } = await supabase.from("richieste_caparra").insert({
    tenant_id: tenantId,
    servizio_id: dati.servizioId,
    operatore_id: dati.operatoreId,
    inizio_iso: dati.inizioIso,
    cliente_nome: clienteNome,
    cliente_telefono: clienteTelefono,
    cliente_email: clienteEmail ?? null,
    importo_centesimi: importoCentesimi,
    stripe_checkout_session_id: session.id,
    stato: "in_attesa",
  });
  if (erroreInsert) {
    return { ok: false, errore: `Errore avviando il pagamento: ${erroreInsert.message}` };
  }

  return { ok: true, checkoutUrl: session.url };
}

export interface DatiListaAttesaPubblica {
  servizioId: string;
  operatoreId?: string; // assente = va bene qualunque operatore
  dataPreferitaYMD?: string; // il giorno cercato in cercaSlotPubblici, per cui non c'era niente
  clienteNome: string;
  clienteTelefono: string;
  // Opzionale (Fase 1, contatto automatico lista d'attesa, 14/09/2026): se
  // presente e il tenant ha attivato il contatto automatico, abilita
  // l'email quando si libera un posto -- vedi
  // src/lib/booking-engine.server.ts (contattaClienteListaAttesaSeAutomatico).
  clienteEmail?: string;
  // Anti-bot silenzioso (vedi src/lib/anti-bot.ts), stesso di DatiPrenotazionePubblica.
  trappola?: string;
  iniziatoAlleMs?: number;
}

/**
 * Il cliente si iscrive DA SOLO alla lista d'attesa (Fase 6) quando
 * `cercaSlotPubblici` non trova nessuno slot per il giorno scelto -- stesso
 * bisogno del cliente in chat con l'AI (`aggiungi_lista_attesa` in
 * src/lib/ai/tools.ts), stessa unica funzione di scrittura
 * (`aggiungiListaAttesaTenant`, punto 9 di CLAUDE.md), solo un canale diverso
 * per raggiungerla. Prima di questa server action l'unico modo per un
 * cliente reale di finire in lista era chiederlo in chat o telefonare al
 * salone -- chi prenotava dal flusso passo-passo senza usare la chat AI
 * vedeva solo "nessuna disponibilità, prova un altro giorno" e uscivo dal
 * sito senza lasciare traccia.
 */
export async function iscrivitiListaAttesaPubblico(
  slug: string,
  dati: DatiListaAttesaPubblica
): Promise<RisultatoAzionePubblica> {
  // Stesso anti-bot silenzioso di prenotaPubblico -- finta conferma sul
  // campo trappola (qui non c'è nessun id da inventare, `ok: true` basta).
  if (campoTrappolaCompilato(dati.trappola)) return { ok: true };
  if (formPubblicoCompilatoTroppoVeloce(dati.iniziatoAlleMs)) {
    return { ok: false, errore: "Richiesta non valida, riprova." };
  }

  const clienteNome = dati.clienteNome.trim().slice(0, 200);
  const clienteTelefono = dati.clienteTelefono.trim();
  const clienteEmail = dati.clienteEmail?.trim().slice(0, 200) || undefined;

  if (!dati.servizioId) return { ok: false, errore: "Servizio non specificato." };
  if (!FORMATO_TELEFONO.test(clienteTelefono)) {
    return { ok: false, errore: "Inserisci un numero di telefono valido." };
  }
  if (clienteEmail && !FORMATO_EMAIL.test(clienteEmail)) {
    return { ok: false, errore: "Inserisci un'email valida, o lascia il campo vuoto." };
  }
  if (dati.dataPreferitaYMD && !FORMATO_DATA_YMD.test(dati.dataPreferitaYMD)) {
    return { ok: false, errore: "Richiesta non valida." };
  }

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const risultato = await aggiungiListaAttesaTenant(supabase, tenantId, {
    servizioId: dati.servizioId,
    operatoreId: dati.operatoreId,
    dataPreferitaYMD: dati.dataPreferitaYMD,
    clienteNome: clienteNome || undefined,
    clienteTelefono,
    clienteEmail,
    creatoDa: "pubblico",
  });
  if (!risultato.ok) return { ok: false, errore: risultato.errore };
  return { ok: true };
}
