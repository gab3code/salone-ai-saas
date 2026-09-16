import { describe, it, expect, vi, beforeEach } from "vitest";
import { creaSupabaseFinto, type ChiamataScrittura } from "@/test/supabase-finto";
import {
  parsaOrarioLocale,
  caricaContestoBooking,
  verificaConflittoTenant,
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
  aggiungiListaAttesaTenant,
  trovaSlotEStatoGiornoTenant,
} from "./booking-engine.server";
import type { AppuntamentoEsistente } from "./booking-engine";

// Isola questo livello dalla sincronizzazione calendari esterni (Fase 6bis):
// quella ha già i suoi test (ics.test.ts) e le sue chiamate di rete vere --
// qui vogliamo verificare SOLO la logica di booking-engine.server.ts, con
// "nessun calendario esterno collegato" come caso di default (coerente con
// il comportamento fail-open reale). I test su verificaConflittoTenant e
// caricaContestoBooking sotto sovrascrivono il valore quando serve
// verificare che un impegno esterno venga davvero fuso con quelli interni.
vi.mock("@/lib/calendario-esterno/collegamenti.server", () => ({
  caricaImpegniEsterni: vi.fn(),
}));
import { caricaImpegniEsterni } from "@/lib/calendario-esterno/collegamenti.server";

const caricaImpegniEsterniFinto = vi.mocked(caricaImpegniEsterni);

// Le notifiche email (Fase 6, Gruppo B-bis #1) hanno già i loro test dedicati
// in notifiche.server.test.ts, con un client admin vero da mockare a parte --
// qui isoliamo creaAppuntamentoTenant da quel dettaglio (altrimenti ogni test
// scrittura di questo file dovrebbe anche fornire risposte finte per le query
// di notifiche.server.ts, che non c'entrano con ciò che questi test
// verificano). SOLO `inviaNotificheNuovoAppuntamento` è mockata -- il resto
// del modulo (escapeHtml/formattaOrario/urlBaseSito) resta quello vero,
// perché `contattaClienteListaAttesaSeAutomatico` (Fase 1, contatto
// automatico lista d'attesa) li importa da qui e un mock "tutto il modulo"
// li renderebbe `undefined`, rompendo quella funzione.
vi.mock("@/lib/email/notifiche.server", async (importOriginal) => {
  const reale = await importOriginal<typeof import("@/lib/email/notifiche.server")>();
  return { ...reale, inviaNotificheNuovoAppuntamento: vi.fn().mockResolvedValue(undefined) };
});

// Contatto automatico della lista d'attesa (Fase 1, 14/09/2026):
// booking-engine.server.ts ora chiama direttamente questi due moduli --
// mockati qui allo stesso modo, per verificare nei test sotto CHE vengano
// chiamati (o non chiamati) a seconda del toggle/piano del tenant.
vi.mock("@/lib/email/mailjet.server", () => ({ inviaEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/sms/invio.server", () => ({ inviaSmsSeInclusoNelPiano: vi.fn().mockResolvedValue(true) }));
import { inviaEmail } from "@/lib/email/mailjet.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";

const inviaEmailFinta = vi.mocked(inviaEmail);
const inviaSmsSeInclusoNelPianoFinto = vi.mocked(inviaSmsSeInclusoNelPiano);

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const OPERATORE_ID = "operatore-1";
const SERVIZIO_ID = "servizio-1";
const FUSO = "Europe/Rome";

// Luglio (CEST, UTC+2) per una conversione fissa e verificabile a mano:
// 16:00 civile Roma <-> 14:00 UTC reale. Usato in tutti i test scrittura per
// controllare che la conversione fuso orario applicata PRIMA di scrivere su
// Postgres sia quella giusta -- è esattamente il bug risolto l'11/09/2026
// (problema noto #1), quindi merita copertura diretta qui, non solo sul
// modulo puro fuso-orario.test.ts.
const INIZIO_PSEUDO = new Date(Date.UTC(2026, 6, 15, 16, 0, 0)); // 2026-07-15T16:00 civile
const INIZIO_REALE_ISO = "2026-07-15T14:00:00.000Z";
const FINE_REALE_ISO = "2026-07-15T14:30:00.000Z"; // servizio da 30 minuti

function rispostaTenantPiano(piano: string) {
  return { data: { piano }, error: null };
}
function rispostaTenantFuso(fuso = FUSO) {
  return { data: { fuso_orario: fuso }, error: null };
}
// Fixture per verificaOperatoreCompatibile (controllo aggiunto il 15/09/2026,
// vedi commento sulla funzione): risposta "operatore valido per questo
// tenant, attivo, compatibile col servizio" -- usata in ogni test di
// creaAppuntamentoTenant/modificaAppuntamentoTenant che arriva a scrivere
// davvero, non solo in quelli che testano esplicitamente questo controllo.
function rispostaOperatoreValido() {
  return { data: { id: OPERATORE_ID, attivo: true }, error: null };
}
function rispostaOperatoreCompatibileConServizio() {
  return { data: { operatore_id: OPERATORE_ID }, error: null };
}

beforeEach(() => {
  caricaImpegniEsterniFinto.mockReset();
  caricaImpegniEsterniFinto.mockResolvedValue([]);
  inviaEmailFinta.mockReset();
  inviaEmailFinta.mockResolvedValue(true);
  inviaSmsSeInclusoNelPianoFinto.mockReset();
  inviaSmsSeInclusoNelPianoFinto.mockResolvedValue(true);
});

describe("parsaOrarioLocale", () => {
  it("accetta 'YYYY-MM-DDTHH:MM' senza fuso esplicito, trattato come pseudo-UTC", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("accetta i secondi espliciti", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:30");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:30.000Z");
  });

  it("accetta un fuso esplicito 'Z'", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00Z");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("accetta un offset esplicito e lo converte", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00+02:00");
    expect(d?.toISOString()).toBe("2026-09-05T13:00:00.000Z");
  });

  // Regressione (13/09/2026): `cercaSlotPubblici` (src/app/s/[slug]/azioni.ts)
  // genera gli `inizioIso` con `Date.toISOString()`, che include SEMPRE i
  // millisecondi -- prima del fix la regex li rifiutava e OGNI prenotazione
  // dal flusso pubblico diretto falliva con "Orario non valido". Scoperto
  // testando dal vivo, non da un test: coperto qui perché non riaccada.
  it("accetta i millisecondi espliciti con fuso 'Z' (formato di Date.toISOString())", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00.000Z");
    expect(d?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("accetta i millisecondi espliciti con un offset", () => {
    const d = parsaOrarioLocale("2026-09-05T15:00:00.500+02:00");
    expect(d?.toISOString()).toBe("2026-09-05T13:00:00.500Z");
  });

  it("rifiuta una stringa che non è una data, mai un valore a caso", () => {
    expect(parsaOrarioLocale("non-una-data")).toBeNull();
  });

  it("rifiuta una data senza orario (formato incompleto)", () => {
    expect(parsaOrarioLocale("2026-09-05")).toBeNull();
  });

  it("rifiuta un'ora fuori range anche se il formato sembra giusto (25:00 non esiste)", () => {
    // Il parser di V8 è lassista su `new Date(stringaLibera)` ma rigoroso sul
    // formato ISO esteso con fuso esplicito -- qui verifichiamo che la nostra
    // validazione non lasci passare un valore così silenziosamente.
    expect(parsaOrarioLocale("2026-09-05T25:00")).toBeNull();
  });
});

describe("caricaContestoBooking", () => {
  it("mappa orari/chiusure/operatori/servizi e converte gli appuntamenti da reale a pseudo-UTC", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: {
        select: [
          {
            data: [
              {
                giorno_settimana: 1,
                chiuso: false,
                apertura: "09:00:00",
                chiusura: "19:00:00",
                pausa_inizio: null,
                pausa_fine: null,
              },
            ],
            error: null,
          },
        ],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [{ id: OPERATORE_ID, attivo: true }], error: null }] },
      operatori_servizi: {
        select: [{ data: [{ operatore_id: OPERATORE_ID, servizio_id: SERVIZIO_ID }], error: null }],
      },
      appuntamenti: {
        select: [
          {
            data: [
              {
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });

    const contesto = await caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO);

    expect(contesto.orari).toEqual([
      {
        giornoSettimana: 1,
        chiuso: false,
        apertura: "09:00",
        chiusura: "19:00",
        pausaInizio: undefined,
        pausaFine: undefined,
      },
    ]);
    expect(contesto.operatori).toEqual([{ id: OPERATORE_ID, attivo: true, servizioIds: [SERVIZIO_ID] }]);
    // L'appuntamento è tornato dal DB in tempo reale (14:00 UTC) -- deve
    // essere convertito a pseudo-UTC (16:00, l'ora civile del salone) prima
    // di arrivare al motore puro.
    expect(contesto.appuntamenti).toHaveLength(1);
    expect(contesto.appuntamenti[0].inizio.toISOString()).toBe("2026-07-15T16:00:00.000Z");
    expect(contesto.appuntamenti[0].fine.toISOString()).toBe("2026-07-15T16:30:00.000Z");
  });

  it("fonde gli impegni dei calendari esterni collegati con gli appuntamenti interni", async () => {
    const impegnoEsterno: AppuntamentoEsistente = {
      operatoreId: OPERATORE_ID,
      inizio: new Date(Date.UTC(2026, 6, 15, 18, 0, 0)),
      fine: new Date(Date.UTC(2026, 6, 15, 18, 30, 0)),
      stato: "confermato",
    };
    caricaImpegniEsterniFinto.mockResolvedValue([impegnoEsterno]);

    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: { select: [{ data: [], error: null }] },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });

    const contesto = await caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO);

    expect(contesto.appuntamenti).toEqual([impegnoEsterno]);
  });

  it("lancia un errore leggibile se una query fallisce, mai un dato a metà", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: { select: [{ data: null, error: { message: "connessione persa" } }] },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      operatori_servizi: { select: [{ data: [], error: null }] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });

    await expect(caricaContestoBooking(supabase, TENANT_ID, INIZIO_PSEUDO, INIZIO_PSEUDO)).rejects.toThrow(
      /orari.*connessione persa/
    );
  });
});

// Mercoledì 2026-07-15 (giorno_settimana = 3), stessa data usata sopra.
const MERCOLEDI = new Date(Date.UTC(2026, 6, 15));

describe("trovaSlotEStatoGiornoTenant", () => {
  // Bug UX segnalato da Gabriel il 14/09/2026: `cercaSlotPubblici` (flusso di
  // prenotazione pubblico, src/app/s/[slug]/azioni.ts) mostrava lo stesso
  // identico "nessuna disponibilità" + modulo lista d'attesa sia per un
  // giorno di chiusura sia per un giorno aperto ma pieno -- iscriversi alla
  // lista d'attesa in un giorno di chiusura non ha senso, nessuno slot si
  // libererà mai lì. Questi due test coprono esattamente la distinzione che
  // `giornoChiuso` nel risultato deve rendere possibile.
  it("giorno di chiusura (nessun orario aperto quel giorno): nessuno slot e giornoChiuso true", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: {
        select: [{ data: [{ giorno_settimana: 3, chiuso: true, apertura: null, chiusura: null, pausa_inizio: null, pausa_fine: null }], error: null }],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [{ id: OPERATORE_ID, attivo: true }], error: null }] },
      operatori_servizi: {
        select: [{ data: [{ operatore_id: OPERATORE_ID, servizio_id: SERVIZIO_ID }], error: null }],
      },
      appuntamenti: { select: [{ data: [], error: null }] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
    });

    const risultato = await trovaSlotEStatoGiornoTenant(supabase, TENANT_ID, {
      data: MERCOLEDI,
      servizioIds: [SERVIZIO_ID],
    });

    expect(risultato.slot).toEqual([]);
    expect(risultato.giornoChiuso).toBe(true);
  });

  it("giorno aperto ma completamente occupato: nessuno slot ma giornoChiuso false", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      orari_apertura: {
        select: [
          {
            data: [{ giorno_settimana: 3, chiuso: false, apertura: "09:00:00", chiusura: "10:00:00", pausa_inizio: null, pausa_fine: null }],
            error: null,
          },
        ],
      },
      chiusure: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [{ id: OPERATORE_ID, attivo: true }], error: null }] },
      operatori_servizi: {
        select: [{ data: [{ operatore_id: OPERATORE_ID, servizio_id: SERVIZIO_ID }], error: null }],
      },
      // Un solo appuntamento confermato che copre TUTTO l'orario di apertura
      // (09:00-10:00 reale, coerente col fuso Europe/Rome usato altrove in
      // questo file per l'estate: 09:00-10:00 civile = 07:00-08:00 UTC).
      appuntamenti: {
        select: [
          {
            data: [
              {
                operatore_id: OPERATORE_ID,
                inizio: "2026-07-15T07:00:00.000Z",
                fine: "2026-07-15T08:00:00.000Z",
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
    });

    const risultato = await trovaSlotEStatoGiornoTenant(supabase, TENANT_ID, {
      data: MERCOLEDI,
      servizioIds: [SERVIZIO_ID],
    });

    expect(risultato.slot).toEqual([]);
    expect(risultato.giornoChiuso).toBe(false);
  });
});

describe("verificaConflittoTenant", () => {
  it("nessuna riga, nessun impegno esterno -> nessun conflitto", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(false);
  });

  it("una riga confermata nello stesso slot dello stesso operatore -> conflitto", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: {
        select: [
          {
            data: [
              {
                id: "altro-appuntamento",
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(true);
  });

  it("esclude l'appuntamento che si sta modificando (ignoraAppuntamentoId), non risulta in conflitto con se stesso", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: {
        select: [
          {
            data: [
              {
                id: "appuntamento-in-modifica",
                operatore_id: OPERATORE_ID,
                inizio: INIZIO_REALE_ISO,
                fine: FINE_REALE_ISO,
                stato: "confermato",
              },
            ],
            error: null,
          },
        ],
      },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
      ignoraAppuntamentoId: "appuntamento-in-modifica",
    });
    expect(conflitto).toBe(false);
  });

  it("un impegno su un calendario esterno collegato blocca lo slot come un appuntamento interno", async () => {
    caricaImpegniEsterniFinto.mockResolvedValue([
      { operatoreId: OPERATORE_ID, inizio: INIZIO_PSEUDO, fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000), stato: "confermato" },
    ]);
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantFuso()] },
      appuntamenti: { select: [{ data: [], error: null }] },
    });
    const conflitto = await verificaConflittoTenant(supabase, TENANT_ID, {
      inizio: INIZIO_PSEUDO,
      fine: new Date(INIZIO_PSEUDO.getTime() + 30 * 60_000),
      operatoreId: OPERATORE_ID,
    });
    expect(conflitto).toBe(true);
  });
});

describe("creaAppuntamentoTenant", () => {
  it("blocca la creazione se il piano Free ha raggiunto il tetto mensile di prenotazioni", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("free")] },
      appuntamenti: { select: [{ data: null, error: null, count: 60 }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/piano Free/);
  });

  it("non blocca un piano diverso da Free anche con molte prenotazioni (nessun tetto per gli altri piani)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "nuovo-appuntamento" }, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(true);
  });

  it("restituisce un errore esplicito se il servizio non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth")] },
      servizi: { select: [{ data: null, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: false, errore: "Servizio non trovato." });
  });

  it("blocca la creazione se l'operatore ha già un appuntamento in quello slot", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: {
        select: [
          {
            data: [
              { id: "x", operatore_id: OPERATORE_ID, inizio: INIZIO_REALE_ISO, fine: FINE_REALE_ISO, stato: "confermato" },
            ],
            error: null,
          },
        ],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/già un appuntamento/);
  });

  it("scrive l'istante REALE corretto (convertito dal fuso del tenant), non l'orario pseudo-UTC grezzo", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: {
        select: [{ data: [], error: null }],
        insert: [{ data: { id: "nuovo-appuntamento" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: true, appuntamentoId: "nuovo-appuntamento" });
    expect(supabase.registro.insert).toHaveLength(1);
    const scrittura = supabase.registro.insert[0] as { tabella: string; payload: Record<string, unknown> };
    expect(scrittura.tabella).toBe("appuntamenti");
    expect(scrittura.payload.inizio).toBe(INIZIO_REALE_ISO);
    expect(scrittura.payload.fine).toBe(FINE_REALE_ISO);
  });

  it("trova un cliente esistente per telefono invece di duplicarlo", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "app-1" }, error: null }] },
      clienti: { select: [{ data: { id: "cliente-esistente" }, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3331234567",
      creatoDa: "manuale",
    });
    expect(risultato.ok).toBe(true);
    expect(supabase.registro.insert.some((c: ChiamataScrittura) => c.tabella === "clienti")).toBe(false);
    const scritturaAppuntamento = supabase.registro.insert.find(
      (c: ChiamataScrittura) => c.tabella === "appuntamenti"
    ) as { payload: Record<string, unknown> };
    expect(scritturaAppuntamento.payload.cliente_id).toBe("cliente-esistente");
  });

  it("crea un cliente nuovo se il telefono non corrisponde a nessuno già registrato", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "app-1" }, error: null }] },
      clienti: {
        select: [{ data: null, error: null }],
        insert: [{ data: { id: "cliente-nuovo" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3339999999",
      clienteNome: "Cliente Test",
      creatoDa: "ai",
    });
    expect(risultato.ok).toBe(true);
    const scritturaCliente = supabase.registro.insert.find(
      (c: ChiamataScrittura) => c.tabella === "clienti"
    ) as { payload: Record<string, unknown> };
    expect(scritturaCliente.payload).toMatchObject({
      tenant_id: TENANT_ID,
      nome: "Cliente Test",
      telefono: "3339999999",
      creato_da_ai: true,
    });
  });

  // Anti-abuso sul canale pubblico (Gruppo D punto 1 di PIANO.md, chiesto
  // esplicitamente da Gabriel il 13/09/2026): questi controlli si applicano
  // SOLO a creatoDa === "pubblico" -- nessuno dei test sopra (tutti "manuale"
  // o "ai") li attraversa, quindi restano invariati.
  it("blocca il canale pubblico se il volume di prenotazioni pubbliche recenti per il tenant è troppo alto", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth")] },
      // 25 = LIMITE_VOLUME_PUBBLICO_PER_FINESTRA (alzato da 8 il 14/09/2026,
      // vedi commento nel file sorgente sul perché).
      appuntamenti: { select: [{ data: null, error: null, count: 25 }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "pubblico",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/Troppe prenotazioni/);
  });

  it("blocca il canale pubblico se lo stesso telefono ha appena prenotato (anti-burst)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth")] },
      appuntamenti: {
        select: [
          { data: null, error: null, count: 0 }, // volume sotto soglia
          { data: { created_at: new Date().toISOString() }, error: null }, // stesso cliente, appena prenotato
        ],
      },
      clienti: { select: [{ data: { id: "cliente-esistente" }, error: null }] },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3331234567",
      creatoDa: "pubblico",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/Attendi qualche istante/);
  });

  it("non blocca il canale pubblico se un cliente nuovo (mai visto) prenota, anche senza volume pregresso", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: {
        select: [
          { data: null, error: null, count: 0 }, // volume sotto soglia
          { data: [], error: null }, // verificaConflittoTenant: nessun conflitto
        ],
        insert: [{ data: { id: "nuovo-appuntamento" }, error: null }],
      },
      clienti: {
        // Interrogata due volte: prima da stessoTelefonoTroppoRecentePubblico
        // (nessun cliente esistente -> mai "troppo recente"), poi da
        // trovaOCreaCliente (stesso esito, quindi ne crea uno nuovo sotto).
        select: [
          { data: null, error: null },
          { data: null, error: null },
        ],
        insert: [{ data: { id: "cliente-nuovo" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      clienteTelefono: "3339999999",
      creatoDa: "pubblico",
    });
    expect(risultato.ok).toBe(true);
  });

  it("il canale pubblico procede normalmente se sotto entrambe le soglie anti-abuso", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: {
        select: [
          { data: null, error: null, count: 0 }, // volume sotto soglia
          { data: [], error: null }, // verificaConflittoTenant: nessun conflitto
        ],
        insert: [{ data: { id: "nuovo-appuntamento" }, error: null }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "pubblico", // senza clienteTelefono: salta del tutto il controllo anti-burst per telefono
    });
    expect(risultato.ok).toBe(true);
  });

  it("traduce il vincolo Postgres 23P01 (race condition sfuggita al controllo applicativo) in un messaggio chiaro", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
      servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      appuntamenti: {
        select: [{ data: [], error: null }],
        insert: [{ data: null, error: { message: "conflitto", code: "23P01" } }],
      },
    });
    const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
      operatoreId: OPERATORE_ID,
      servizioId: SERVIZIO_ID,
      inizio: INIZIO_PSEUDO,
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({
      ok: false,
      errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
    });
  });

  // Servizi consecutivi (punto 12, collegato il 16/09/2026): la logica pura
  // (calcolaSlotServiziConsecutivi) esisteva già e aveva già i suoi test --
  // questi verificano lo strato di SCRITTURA (creaAppuntamentoTenant), che
  // prima accettava solo un servizioId singolo.
  describe("servizi consecutivi (più id in servizioId)", () => {
    const SERVIZIO_ID_2 = "servizio-2";

    it("crea una riga per servizio, in sequenza senza buchi, con lo stesso gruppo_prenotazione_id", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
        servizi: {
          select: [
            { data: [{ id: SERVIZIO_ID, durata_minuti: 30 }, { id: SERVIZIO_ID_2, durata_minuti: 45 }], error: null },
          ],
        },
        operatori: { select: [rispostaOperatoreValido()] },
        operatori_servizi: {
          select: [rispostaOperatoreCompatibileConServizio(), rispostaOperatoreCompatibileConServizio()],
        },
        appuntamenti: {
          select: [{ data: [], error: null }],
          insert: [
            { data: { id: "riga-1" }, error: null },
            { data: { id: "riga-2" }, error: null },
          ],
        },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: [SERVIZIO_ID, SERVIZIO_ID_2],
        inizio: INIZIO_PSEUDO, // 2026-07-15T16:00 civile Roma
        creatoDa: "manuale",
      });
      expect(risultato).toEqual({ ok: true, appuntamentoId: "riga-1" });

      const scritture = supabase.registro.insert.filter(
        (c: ChiamataScrittura) => c.tabella === "appuntamenti"
      ) as { payload: Record<string, unknown> }[];
      expect(scritture).toHaveLength(2);

      const gruppoId = scritture[0].payload.gruppo_prenotazione_id;
      expect(gruppoId).toBeTruthy();
      expect(scritture[1].payload.gruppo_prenotazione_id).toBe(gruppoId);

      // Primo servizio: 16:00-16:30 civile -> 14:00-14:30 UTC reale.
      expect(scritture[0].payload.servizio_id).toBe(SERVIZIO_ID);
      expect(scritture[0].payload.inizio).toBe("2026-07-15T14:00:00.000Z");
      expect(scritture[0].payload.fine).toBe("2026-07-15T14:30:00.000Z");
      // Secondo servizio: riprende esattamente dove finisce il primo, nessun
      // buco -- 16:30-17:15 civile -> 14:30-15:15 UTC reale.
      expect(scritture[1].payload.servizio_id).toBe(SERVIZIO_ID_2);
      expect(scritture[1].payload.inizio).toBe("2026-07-15T14:30:00.000Z");
      expect(scritture[1].payload.fine).toBe("2026-07-15T15:15:00.000Z");
    });

    it("un solo servizio (array di un elemento) si comporta esattamente come una stringa singola: gruppo_prenotazione_id null", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
        servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
        operatori: { select: [rispostaOperatoreValido()] },
        operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
        appuntamenti: { select: [{ data: [], error: null }], insert: [{ data: { id: "riga-1" }, error: null }] },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: [SERVIZIO_ID],
        inizio: INIZIO_PSEUDO,
        creatoDa: "manuale",
      });
      expect(risultato).toEqual({ ok: true, appuntamentoId: "riga-1" });
      const scrittura = supabase.registro.insert[0] as { payload: Record<string, unknown> };
      expect(scrittura.payload.gruppo_prenotazione_id).toBeNull();
    });

    it("rifiuta la catena se l'operatore non esegue TUTTI i servizi (non solo il primo)", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth")] },
        servizi: {
          select: [
            { data: [{ id: SERVIZIO_ID, durata_minuti: 30 }, { id: SERVIZIO_ID_2, durata_minuti: 45 }], error: null },
          ],
        },
        operatori: { select: [rispostaOperatoreValido()] },
        // Compatibile col primo servizio, NON col secondo.
        operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio(), { data: null, error: null }] },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: [SERVIZIO_ID, SERVIZIO_ID_2],
        inizio: INIZIO_PSEUDO,
        creatoDa: "manuale",
      });
      expect(risultato).toEqual({ ok: false, errore: "Questo operatore non esegue il servizio richiesto." });
      expect(supabase.registro.insert.some((c: ChiamataScrittura) => c.tabella === "appuntamenti")).toBe(false);
    });

    it("verifica il conflitto sull'intera durata della catena, non solo sul primo servizio", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso()] },
        servizi: {
          select: [
            { data: [{ id: SERVIZIO_ID, durata_minuti: 30 }, { id: SERVIZIO_ID_2, durata_minuti: 45 }], error: null },
          ],
        },
        operatori: { select: [rispostaOperatoreValido()] },
        operatori_servizi: {
          select: [rispostaOperatoreCompatibileConServizio(), rispostaOperatoreCompatibileConServizio()],
        },
        appuntamenti: {
          // Un appuntamento esistente che si sovrappone SOLO con la finestra
          // del secondo servizio (14:45-15:00 reale) -- se il controllo
          // guardasse solo il primo servizio (14:00-14:30), lo lascerebbe
          // passare per errore.
          select: [
            {
              data: [{ id: "x", operatore_id: OPERATORE_ID, inizio: "2026-07-15T14:45:00.000Z", fine: "2026-07-15T15:00:00.000Z", stato: "confermato" }],
              error: null,
            },
          ],
        },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: [SERVIZIO_ID, SERVIZIO_ID_2],
        inizio: INIZIO_PSEUDO,
        creatoDa: "manuale",
      });
      expect(risultato.ok).toBe(false);
      if (!risultato.ok) expect(risultato.errore).toMatch(/già un appuntamento/);
    });

    it("se una riga della catena fallisce a metà (race condition), cancella quelle già create dello stesso gruppo prima di restituire l'errore", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth"), rispostaTenantFuso(), rispostaTenantFuso()] },
        servizi: {
          select: [
            { data: [{ id: SERVIZIO_ID, durata_minuti: 30 }, { id: SERVIZIO_ID_2, durata_minuti: 45 }], error: null },
          ],
        },
        operatori: { select: [rispostaOperatoreValido()] },
        operatori_servizi: {
          select: [rispostaOperatoreCompatibileConServizio(), rispostaOperatoreCompatibileConServizio()],
        },
        appuntamenti: {
          select: [{ data: [], error: null }],
          insert: [
            { data: { id: "riga-1" }, error: null },
            { data: null, error: { message: "conflitto", code: "23P01" } },
          ],
        },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: [SERVIZIO_ID, SERVIZIO_ID_2],
        inizio: INIZIO_PSEUDO,
        creatoDa: "manuale",
      });
      expect(risultato).toEqual({
        ok: false,
        errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
      });
      // La prima riga (già scritta con successo) deve essere cancellata --
      // non deve restare una catena parziale/rotta in calendario.
      expect(supabase.registro.delete).toEqual([{ tabella: "appuntamenti" }]);
    });
  });

  // Bug di isolamento multi-tenant trovato in un audit del 15/09/2026 (vedi
  // il commento su verificaOperatoreCompatibile in booking-engine.server.ts):
  // niente, prima di questo controllo, impediva di scrivere un appuntamento
  // con un operatore che non appartiene affatto a questo tenant.
  describe("isolamento multi-tenant e coerenza operatore/servizio (verificaOperatoreCompatibile)", () => {
    it("rifiuta un operatore che non esiste (o appartiene a un altro tenant)", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth")] },
        servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
        operatori: { select: [{ data: null, error: null }] },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: "operatore-di-un-altro-tenant",
        servizioId: SERVIZIO_ID,
        inizio: INIZIO_PSEUDO,
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: false, errore: "Operatore non trovato." });
      // Non deve MAI arrivare a scrivere l'appuntamento.
      expect(supabase.registro.insert.some((c: ChiamataScrittura) => c.tabella === "appuntamenti")).toBe(false);
    });

    it("rifiuta un operatore disattivato", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth")] },
        servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
        operatori: { select: [{ data: { id: OPERATORE_ID, attivo: false }, error: null }] },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: SERVIZIO_ID,
        inizio: INIZIO_PSEUDO,
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: false, errore: "Questo operatore non è più disponibile." });
    });

    it("rifiuta un operatore valido per il tenant ma che non esegue questo servizio", async () => {
      const supabase = creaSupabaseFinto({
        tenants: { select: [rispostaTenantPiano("growth")] },
        servizi: { select: [{ data: [{ id: SERVIZIO_ID, durata_minuti: 30 }], error: null }] },
        operatori: { select: [rispostaOperatoreValido()] },
        operatori_servizi: { select: [{ data: null, error: null }] },
      });
      const risultato = await creaAppuntamentoTenant(supabase, TENANT_ID, {
        operatoreId: OPERATORE_ID,
        servizioId: SERVIZIO_ID,
        inizio: INIZIO_PSEUDO,
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: false, errore: "Questo operatore non esegue il servizio richiesto." });
    });

    it("stesso controllo in modificaAppuntamentoTenant: rifiuta un operatore di un altro tenant sullo spostamento", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { select: [{ data: { servizio_id: SERVIZIO_ID }, error: null }] },
        servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
        operatori: { select: [{ data: null, error: null }] },
      });
      const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1", {
        operatoreId: "operatore-di-un-altro-tenant",
        inizio: INIZIO_PSEUDO,
      });
      expect(risultato).toEqual({ ok: false, errore: "Operatore non trovato." });
      expect(supabase.registro.update).toHaveLength(0);
    });
  });
});

describe("modificaAppuntamentoTenant", () => {
  const APPUNTAMENTO_ID = "appuntamento-1";

  it("restituisce un errore esplicito se l'appuntamento non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { select: [{ data: null, error: null }] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({ ok: false, errore: "Appuntamento non trovato." });
  });

  it("sposta l'appuntamento scrivendo l'istante reale corretto", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null }, // appuntamento attuale
          { data: [], error: null }, // righe per il controllo conflitti (nessuna)
        ],
        update: [{ data: null, error: null }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({ ok: true });
    expect(supabase.registro.update).toHaveLength(1);
    const scrittura = supabase.registro.update[0] as { tabella: string; payload: Record<string, unknown> };
    expect(scrittura.tabella).toBe("appuntamenti");
    expect(scrittura.payload.inizio).toBe(INIZIO_REALE_ISO);
    expect(scrittura.payload.fine).toBe(FINE_REALE_ISO);
  });

  it("blocca lo spostamento se il nuovo slot è in conflitto con un altro appuntamento", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null },
          {
            data: [
              { id: "altro", operatore_id: OPERATORE_ID, inizio: INIZIO_REALE_ISO, fine: FINE_REALE_ISO, stato: "confermato" },
            ],
            error: null,
          },
        ],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      tenants: { select: [rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/già un appuntamento/);
  });

  it("traduce il vincolo Postgres 23P01 in un messaggio chiaro anche per lo spostamento", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID }, error: null },
          { data: [], error: null },
        ],
        update: [{ data: null, error: { message: "conflitto", code: "23P01" } }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({
      ok: false,
      errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
    });
  });

  it("senza incrementaSpostamentiEffettuati non tocca il contatore (dashboard/AI, Fase 4)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID, spostamenti_effettuati: 0 }, error: null },
          { data: [], error: null },
        ],
        update: [{ data: null, error: null }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
    });
    expect(risultato).toEqual({ ok: true });
    const scrittura = supabase.registro.update[0] as { payload: Record<string, unknown> };
    expect(scrittura.payload.spostamenti_effettuati).toBeUndefined();
  });

  it("con incrementaSpostamentiEffettuati incrementa il contatore esistente (spostamento self-service, Fase 4)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: {
        select: [
          { data: { servizio_id: SERVIZIO_ID, spostamenti_effettuati: 0 }, error: null },
          { data: [], error: null },
        ],
        update: [{ data: null, error: null }],
      },
      servizi: { select: [{ data: { durata_minuti: 30 }, error: null }] },
      operatori: { select: [rispostaOperatoreValido()] },
      operatori_servizi: { select: [rispostaOperatoreCompatibileConServizio()] },
      tenants: { select: [rispostaTenantFuso(), rispostaTenantFuso()] },
    });
    const risultato = await modificaAppuntamentoTenant(supabase, TENANT_ID, APPUNTAMENTO_ID, {
      operatoreId: OPERATORE_ID,
      inizio: INIZIO_PSEUDO,
      incrementaSpostamentiEffettuati: true,
    });
    expect(risultato).toEqual({ ok: true });
    const scrittura = supabase.registro.update[0] as { payload: Record<string, unknown> };
    expect(scrittura.payload.spostamenti_effettuati).toBe(1);
  });
});

describe("cancellaAppuntamentoTenant", () => {
  it("restituisce un errore esplicito se l'appuntamento non esiste (o non è di questo tenant)", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: [], error: null }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "non-esiste");
    expect(risultato).toEqual({ ok: false, errore: "Appuntamento non trovato." });
  });

  it("cancella (soft-delete a stato 'cancellato') un appuntamento esistente", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: [{ id: "appuntamento-1" }], error: null }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
    expect(risultato).toEqual({ ok: true });
    expect(supabase.registro.update[0]).toMatchObject({ tabella: "appuntamenti", payload: { stato: "cancellato" } });
  });

  it("propaga un errore del database come messaggio leggibile", async () => {
    const supabase = creaSupabaseFinto({
      appuntamenti: { update: [{ data: null, error: { message: "timeout" } }] },
    });
    const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
    expect(risultato).toEqual({ ok: false, errore: "Errore cancellando l'appuntamento: timeout" });
  });

  // Lista d'attesa automatica (Fase 6, PIANO.md Gruppo B punto 3): la riga
  // restituita da .update(...).select(...) ora porta anche servizio_id/
  // operatore_id/inizio, usati SOLO per cercare un match in lista_attesa.
  describe("lista d'attesa automatica alla cancellazione", () => {
    const RIGA_CANCELLATA = {
      id: "appuntamento-1",
      servizio_id: SERVIZIO_ID,
      operatore_id: OPERATORE_ID,
      inizio: INIZIO_REALE_ISO, // 2026-07-15T14:00 reale = 2026-07-15T16:00 civile Roma (CEST)
    };

    it("trova il primo in coda (nessun operatore/giorno richiesto) e lo marca 'proposto'", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
        tenants: { select: [rispostaTenantFuso()] },
        lista_attesa: {
          select: [
            {
              data: [{ id: "attesa-1", cliente_nome: "Maria", cliente_telefono: "3331112222", operatore_id: null, data_preferita: null }],
              error: null,
            },
          ],
          update: [{ data: null, error: null }],
        },
      });

      const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
      expect(risultato).toEqual({
        ok: true,
        listaAttesaAvvisata: { id: "attesa-1", clienteNome: "Maria", clienteTelefono: "3331112222" },
      });
      expect(supabase.registro.update[1]).toMatchObject({
        tabella: "lista_attesa",
        payload: { stato: "proposto", slot_liberato_operatore_id: OPERATORE_ID },
      });
    });

    it("nessun candidato in coda per questo servizio: cancellazione ok, nessun avviso", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
        tenants: { select: [rispostaTenantFuso()] },
        lista_attesa: { select: [{ data: [], error: null }] },
      });

      const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
      expect(risultato).toEqual({ ok: true });
    });

    it("scarta un candidato che vuole un altro operatore, tiene chi accetta qualunque operatore (FIFO)", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
        tenants: { select: [rispostaTenantFuso()] },
        lista_attesa: {
          select: [
            {
              data: [
                { id: "attesa-1", cliente_nome: "Luca", cliente_telefono: "1", operatore_id: "un-altro-operatore", data_preferita: null },
                { id: "attesa-2", cliente_nome: "Sara", cliente_telefono: "2", operatore_id: null, data_preferita: null },
              ],
              error: null,
            },
          ],
          update: [{ data: null, error: null }],
        },
      });

      const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
      expect(risultato).toEqual({
        ok: true,
        listaAttesaAvvisata: { id: "attesa-2", clienteNome: "Sara", clienteTelefono: "2" },
      });
    });

    it("scarta un candidato che vuole un altro giorno rispetto allo slot liberato", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
        tenants: { select: [rispostaTenantFuso()] },
        lista_attesa: {
          select: [
            {
              // Lo slot liberato è il 2026-07-15 (civile Roma) -- questo cliente vuole un altro giorno.
              data: [{ id: "attesa-1", cliente_nome: "Luca", cliente_telefono: "1", operatore_id: null, data_preferita: "2026-08-01" }],
              error: null,
            },
          ],
        },
      });

      const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
      expect(risultato).toEqual({ ok: true });
    });

    it("un errore nel controllo lista d'attesa non fa fallire la cancellazione (fail-open)", async () => {
      const supabase = creaSupabaseFinto({
        appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
        tenants: { select: [rispostaTenantFuso()] },
        lista_attesa: { select: [{ data: null, error: { message: "timeout" } }] },
      });

      const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
      expect(risultato).toEqual({ ok: true });
    });

    // Contatto automatico del cliente proposto (Fase 1, 14/09/2026 --
    // decisione con Gabriel: toggle unico per tenant, default manuale,
    // Growth in su, stessa email->SMS fallback delle notifiche di
    // prenotazione). Il match in lista d'attesa è già scritto con successo
    // in tutti questi test -- ciò che varia è SOLO se/come viene contattato.
    describe("contatto automatico del cliente proposto", () => {
      const CANDIDATO_CON_EMAIL = {
        id: "attesa-1",
        cliente_nome: "Maria",
        cliente_telefono: "3331112222",
        cliente_email: "maria@esempio.it",
        operatore_id: null,
        data_preferita: null,
      };
      const CANDIDATO_SENZA_EMAIL = { ...CANDIDATO_CON_EMAIL, cliente_email: null };

      function rispostaTenantContatto(piano: string, contattoAutomatico: boolean) {
        return { data: { nome: "Estetica Test", piano, lista_attesa_contatto_automatico: contattoAutomatico }, error: null };
      }
      function rispostaServizio() {
        return { data: { nome: "Taglio" }, error: null };
      }

      it("toggle disattivato (piano growth): nessun contatto automatico, nessuna email/SMS inviati", async () => {
        const supabase = creaSupabaseFinto({
          appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
          tenants: { select: [rispostaTenantFuso(), rispostaTenantContatto("growth", false)] },
          lista_attesa: {
            select: [{ data: [CANDIDATO_CON_EMAIL], error: null }],
            update: [{ data: null, error: null }],
          },
        });

        const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
        expect(risultato.ok).toBe(true);
        expect(inviaEmailFinta).not.toHaveBeenCalled();
        expect(inviaSmsSeInclusoNelPianoFinto).not.toHaveBeenCalled();
      });

      it("toggle attivo ma piano senza accesso (free): nessun contatto automatico", async () => {
        const supabase = creaSupabaseFinto({
          appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
          tenants: { select: [rispostaTenantFuso(), rispostaTenantContatto("free", true)] },
          lista_attesa: {
            select: [{ data: [CANDIDATO_CON_EMAIL], error: null }],
            update: [{ data: null, error: null }],
          },
        });

        const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
        expect(risultato.ok).toBe(true);
        expect(inviaEmailFinta).not.toHaveBeenCalled();
        expect(inviaSmsSeInclusoNelPianoFinto).not.toHaveBeenCalled();
      });

      it("toggle attivo + piano growth + candidato con email: invia email, non SMS", async () => {
        const supabase = creaSupabaseFinto({
          appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
          tenants: { select: [rispostaTenantFuso(), rispostaTenantContatto("growth", true)] },
          servizi: { select: [rispostaServizio()] },
          lista_attesa: {
            select: [{ data: [CANDIDATO_CON_EMAIL], error: null }],
            update: [{ data: null, error: null }],
          },
        });

        const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
        expect(risultato.ok).toBe(true);
        expect(inviaSmsSeInclusoNelPianoFinto).not.toHaveBeenCalled();
        expect(inviaEmailFinta).toHaveBeenCalledTimes(1);
        const chiamata = inviaEmailFinta.mock.calls[0][0];
        expect(chiamata.a).toBe("maria@esempio.it");
        expect(chiamata.html).toContain("Maria");
        expect(chiamata.html).toContain("Taglio");
      });

      it("toggle attivo + piano growth + candidato senza email (solo telefono): invia SMS, non email", async () => {
        const supabase = creaSupabaseFinto({
          appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
          tenants: { select: [rispostaTenantFuso(), rispostaTenantContatto("growth", true)] },
          servizi: { select: [rispostaServizio()] },
          lista_attesa: {
            select: [{ data: [CANDIDATO_SENZA_EMAIL], error: null }],
            update: [{ data: null, error: null }],
          },
        });

        const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
        expect(risultato.ok).toBe(true);
        expect(inviaEmailFinta).not.toHaveBeenCalled();
        expect(inviaSmsSeInclusoNelPianoFinto).toHaveBeenCalledTimes(1);
        const args = inviaSmsSeInclusoNelPianoFinto.mock.calls[0];
        expect(args[2]).toBe("growth"); // piano
        expect(args[3]).toBe("3331112222"); // telefono
      });

      it("un'eccezione nell'invio (email/dettagli tenant) non fa sparire il match già scritto -- resta ok:true con listaAttesaAvvisata", async () => {
        inviaEmailFinta.mockRejectedValueOnce(new Error("Mailjet giù"));
        const supabase = creaSupabaseFinto({
          appuntamenti: { update: [{ data: [RIGA_CANCELLATA], error: null }] },
          tenants: { select: [rispostaTenantFuso(), rispostaTenantContatto("growth", true)] },
          servizi: { select: [rispostaServizio()] },
          lista_attesa: {
            select: [{ data: [CANDIDATO_CON_EMAIL], error: null }],
            update: [{ data: null, error: null }],
          },
        });

        const risultato = await cancellaAppuntamentoTenant(supabase, TENANT_ID, "appuntamento-1");
        expect(risultato).toEqual({
          ok: true,
          listaAttesaAvvisata: { id: "attesa-1", clienteNome: "Maria", clienteTelefono: "3331112222" },
        });
      });
    });
  });
});

describe("aggiungiListaAttesaTenant", () => {
  it("restituisce un errore esplicito se il servizio non esiste (o è di un altro tenant)", async () => {
    const supabase = creaSupabaseFinto({
      servizi: { select: [{ data: null, error: null }] },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: false, errore: "Servizio non trovato." });
  });

  it("inserisce la riga, con operatore/data preferita a null quando non specificati", async () => {
    const supabase = creaSupabaseFinto({
      servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
      lista_attesa: { insert: [{ data: { id: "attesa-1" }, error: null }] },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "ai",
    });
    expect(risultato).toEqual({ ok: true, listaAttesaId: "attesa-1" });
    expect(supabase.registro.insert[0]).toMatchObject({
      tabella: "lista_attesa",
      payload: { operatore_id: null, data_preferita: null, note: null, creato_da: "ai" },
    });
  });

  it("propaga un errore di inserimento come messaggio leggibile", async () => {
    const supabase = creaSupabaseFinto({
      servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
      lista_attesa: { insert: [{ data: null, error: { message: "timeout" } }] },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "manuale",
    });
    expect(risultato).toEqual({ ok: false, errore: "Errore aggiungendo alla lista d'attesa: timeout" });
  });

  // Anti-abuso sul canale pubblico (stesso principio di creaAppuntamentoTenant sopra).
  it("blocca l'iscrizione pubblica se il volume recente di richieste per il tenant è troppo alto", async () => {
    const supabase = creaSupabaseFinto({
      // 25 = LIMITE_VOLUME_PUBBLICO_PER_FINESTRA (alzato da 8 il 14/09/2026).
      lista_attesa: { select: [{ data: null, error: null, count: 25 }] },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "pubblico",
    });
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/Troppe richieste/);
  });

  it("non blocca il canale 'manuale'/'ai' anche con volume alto in lista_attesa (il controllo è solo per 'pubblico')", async () => {
    const supabase = creaSupabaseFinto({
      servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
      lista_attesa: { insert: [{ data: { id: "attesa-1" }, error: null }] },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "ai",
    });
    expect(risultato).toEqual({ ok: true, listaAttesaId: "attesa-1" });
  });

  it("il canale pubblico procede normalmente se sotto la soglia anti-abuso", async () => {
    const supabase = creaSupabaseFinto({
      servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
      lista_attesa: {
        select: [{ data: null, error: null, count: 0 }],
        insert: [{ data: { id: "attesa-1" }, error: null }],
      },
    });
    const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
      servizioId: SERVIZIO_ID,
      clienteTelefono: "3331112222",
      creatoDa: "pubblico",
    });
    expect(risultato).toEqual({ ok: true, listaAttesaId: "attesa-1" });
  });

  // Bug UX trovato dal vivo da Gabriel il 15/09/2026 (vedi DECISIONS.md):
  // l'AI proponeva la lista d'attesa anche per un giorno in cui l'attività è
  // semplicemente chiusa (nessuno slot si libererà mai lì). Difesa qui, non
  // solo nel prompt/UI, così vale per tutti e tre i canali.
  describe("data_preferita su un giorno di chiusura settimanale", () => {
    // 2026-09-20 è una domenica (giorno_settimana 0).
    const DOMENICA = "2026-09-20";

    it("rifiuta l'iscrizione se data_preferita cade in un giorno marcato chiuso", async () => {
      const supabase = creaSupabaseFinto({
        servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
        orari_apertura: {
          select: [{ data: [{ giorno_settimana: 0, chiuso: true, apertura: null, chiusura: null, pausa_inizio: null, pausa_fine: null }], error: null }],
        },
      });
      const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
        servizioId: SERVIZIO_ID,
        clienteTelefono: "3331112222",
        dataPreferitaYMD: DOMENICA,
        creatoDa: "ai",
      });
      expect(risultato.ok).toBe(false);
      if (!risultato.ok) expect(risultato.errore).toMatch(/chiusa in quel giorno/);
      // Non deve nemmeno arrivare all'insert.
      expect(supabase.registro.insert).toHaveLength(0);
    });

    it("procede normalmente se data_preferita cade in un giorno aperto", async () => {
      const supabase = creaSupabaseFinto({
        servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
        orari_apertura: {
          select: [
            {
              data: [{ giorno_settimana: 0, chiuso: false, apertura: "09:00:00", chiusura: "19:00:00", pausa_inizio: null, pausa_fine: null }],
              error: null,
            },
          ],
        },
        lista_attesa: { insert: [{ data: { id: "attesa-1" }, error: null }] },
      });
      const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
        servizioId: SERVIZIO_ID,
        clienteTelefono: "3331112222",
        dataPreferitaYMD: DOMENICA,
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: true, listaAttesaId: "attesa-1" });
    });

    it("propaga un errore esplicito se il caricamento degli orari fallisce", async () => {
      const supabase = creaSupabaseFinto({
        servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
        orari_apertura: { select: [{ data: null, error: { message: "timeout" } }] },
      });
      const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
        servizioId: SERVIZIO_ID,
        clienteTelefono: "3331112222",
        dataPreferitaYMD: DOMENICA,
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: false, errore: "Errore verificando gli orari: timeout" });
    });

    it("non interroga nemmeno gli orari se data_preferita non è specificata (nessuna regressione)", async () => {
      const supabase = creaSupabaseFinto({
        servizi: { select: [{ data: { id: SERVIZIO_ID }, error: null }] },
        lista_attesa: { insert: [{ data: { id: "attesa-1" }, error: null }] },
      });
      const risultato = await aggiungiListaAttesaTenant(supabase, TENANT_ID, {
        servizioId: SERVIZIO_ID,
        clienteTelefono: "3331112222",
        creatoDa: "ai",
      });
      expect(risultato).toEqual({ ok: true, listaAttesaId: "attesa-1" });
    });
  });
});
