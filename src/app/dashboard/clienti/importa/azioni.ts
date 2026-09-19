"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoImportareClienti } from "@/lib/ruoli";
import { creaClientiInBlocco, completaClienteDoveVuoto, elencaClienti } from "@/lib/clienti.server";
import {
  leggiRubricaDaFoto,
  recuperaRigheConModello,
  MAX_BYTE_FOTO_IMPORT,
  MAX_RIGHE_PER_RECUPERO,
  TIPI_IMMAGINE_IMPORT,
  type TipoImmagineImport,
  type VoceNonLetta,
} from "@/lib/importa-clienti-ai.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";
import { RECUPERI_IMPORT_SENZA_PIANO, tettoRecuperoImport } from "@/lib/ai/limiti";
import { leggiTestoImport } from "@/lib/importa-vcard";
import {
  calcolaDiffImport,
  campiDaCompletare,
  telefonoUtilizzabile,
  type DiffImport,
  type RigaImport,
  MAX_RIGHE_IMPORT,
} from "@/lib/importa-clienti";

/**
 * Import della rubrica: le due azioni server.
 *
 * Stessa architettura dell'onboarding AI, e per la stessa ragione: prima si
 * ANALIZZA e si mostra cosa succederebbe, poi si scrive solo quello che il
 * titolare ha confermato. Qui e' anche piu' importante che altrove -- una
 * rubrica importata male non si "corregge dopo", si ripulisce a mano riga
 * per riga, ed e' esattamente la serata di lavoro che questa funzione esiste
 * per evitare.
 */

export type RisultatoAnalisi =
  | { ok: true; diff: DiffImport }
  | { ok: false; errore: string };

export async function analizzaImportAzione(testo: string): Promise<RisultatoAnalisi> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };

  if (typeof testo !== "string" || testo.trim() === "") {
    return { ok: false, errore: "Incolla l'elenco dei clienti, o carica un file (CSV, rubrica .vcf, o una foto)." };
  }

  const esito = leggiTestoImport(testo);
  if (esito.clienti.length === 0) {
    return {
      ok: false,
      errore:
        "Non ho riconosciuto nessun cliente. Serve almeno un numero di telefono per riga: puoi incollare un CSV, un foglio Excel, un elenco 'nome, numero', o caricare la rubrica del telefono (.vcf).",
    };
  }

  // La rubrica attuale serve a non creare doppioni: va letta TUTTA, non una
  // pagina. `perExport` e' esattamente la lettura completa che serve qui.
  const esistenti = await elencaClienti(accesso.tenantId, { perExport: true });
  if (esistenti.errore) {
    return { ok: false, errore: `Non riesco a leggere la rubrica attuale: ${esistenti.errore}` };
  }

  return {
    ok: true,
    diff: calcolaDiffImport(
      esistenti.clienti.map((c) => ({ id: c.id, nome: c.nome, telefono: c.telefono, email: c.email })),
      esito
    ),
  };
}

export type RisultatoRecupero =
  | { ok: true; proposte: RigaImport[]; nonRecuperate: string[]; rimaste: number; aVita: boolean }
  | { ok: false; errore: string; esaurite?: boolean };

/**
 * Le righe che il lettore non ha capito, passate al modello (19/09/2026).
 *
 * Stesso schema dell'onboarding assistito: la quota si consuma PRIMA di
 * chiamare il modello, anche se poi la chiamata fallisce (vedi
 * usi-interni.server.ts per il perche'). Le proposte tornano gia' confrontate
 * con la rubrica, come le righe lette dal codice, e marcate come proposte
 * dal modello: in revisione partono non spuntate.
 */
export async function recuperaRigheNonCapiteAzione(righe: string[]): Promise<RisultatoRecupero> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };
  const tenantId = accesso.tenantId;

  if (!Array.isArray(righe) || righe.length === 0) return { ok: false, errore: "Nessuna riga da leggere." };
  const daLeggere = righe.filter((r): r is string => typeof r === "string" && r.trim() !== "").slice(0, MAX_RIGHE_PER_RECUPERO);
  if (daLeggere.length === 0) return { ok: false, errore: "Nessuna riga da leggere." };

  const consumo = await consumaLetturaAssistita(supabase, tenantId);
  if (!consumo.ok) return consumo;

  const esito = await recuperaRigheConModello(daLeggere, { tenantId });
  if (!esito.ok) return esito;

  const esistenti = await elencaClienti(tenantId, { perExport: true });
  if (esistenti.errore) {
    return { ok: false, errore: `Non riesco a leggere la rubrica attuale: ${esistenti.errore}` };
  }
  const diff = calcolaDiffImport(
    esistenti.clienti.map((c) => ({ id: c.id, nome: c.nome, telefono: c.telefono, email: c.email })),
    { clienti: esito.esito.proposte, scartate: [] }
  );
  // Chi risulta gia' in rubrica non e' una proposta nuova: si segnala come
  // "gia' presente" nel conteggio, non si ripropone.
  const proposte = [...diff.nuovi, ...diff.giaPresenti].map((r) => ({ ...r, propostoDallAi: true }));
  return { ok: true, proposte, nonRecuperate: esito.esito.nonRecuperate, rimaste: consumo.rimasti, aVita: consumo.aVita };
}

/**
 * Una lettura assistita (righe non capite o foto) consuma un uso della
 * quota "import_clienti", PRIMA di chiamare il modello: se poi la chiamata
 * fallisce l'uso e' speso lo stesso (vedi usi-interni.server.ts).
 */
async function consumaLetturaAssistita(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true; rimasti: number; aVita: boolean } | { ok: false; errore: string; esaurite?: boolean }> {
  const [{ data: tenant }, { count: numeroOperatori }] = await Promise.all([
    supabase.from("tenants").select("piano").eq("id", tenantId).single(),
    supabase.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  const tetto = tettoRecuperoImport(tenant?.piano ?? "", numeroOperatori ?? 1);
  const consumo = await consumaUsoAiInterno(tenantId, "import_clienti", tetto);
  if (!consumo.ok) {
    if (consumo.motivo === "errore") {
      return { ok: false, errore: "Non riesco a verificare la quota adesso. Riprova fra poco." };
    }
    return {
      ok: false,
      esaurite: true,
      errore: tetto.daSempre
        ? `Hai usato tutte e ${RECUPERI_IMPORT_SENZA_PIANO} le letture assistite comprese nel tuo piano. Puoi aggiungere i clienti a mano, oppure passare a Growth.`
        : "Hai finito la quota AI di questo mese. Riparte il primo del mese prossimo.",
    };
  }
  return { ok: true, rimasti: consumo.rimasti, aVita: tetto.daSempre };
}

export type RisultatoFoto =
  | { ok: true; proposte: RigaImport[]; nonLette: VoceNonLetta[]; nonEUnaRubrica: boolean; rimaste: number; aVita: boolean }
  | { ok: false; errore: string; esaurite?: boolean };

/**
 * La foto dell'agenda, letta dal modello (19/09/2026).
 *
 * Il browser manda l'immagine gia' ridotta (1568 px sul lato lungo, JPEG):
 * qui si controlla tipo e dimensione e non ci si fida di nient'altro. Le
 * proposte tornano confrontate con la rubrica e marcate come lette dal
 * modello: in revisione partono TUTTE non spuntate, e accanto a ognuna c'e'
 * la trascrizione da confrontare con la foto.
 */
export async function leggiFotoAzione(immagine: { base64: string; tipo: string }): Promise<RisultatoFoto> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };
  const tenantId = accesso.tenantId;

  if (!immagine || typeof immagine.base64 !== "string" || typeof immagine.tipo !== "string") {
    return { ok: false, errore: "Nessuna foto da leggere." };
  }
  if (!(TIPI_IMMAGINE_IMPORT as readonly string[]).includes(immagine.tipo)) {
    return { ok: false, errore: "Formato non supportato: serve una foto JPEG, PNG o WebP." };
  }
  const base64 = immagine.base64.replace(/^data:[^,]*,/, "");
  if (base64 === "" || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) return { ok: false, errore: "La foto non e' leggibile." };
  if ((base64.length * 3) / 4 > MAX_BYTE_FOTO_IMPORT) {
    return { ok: false, errore: "La foto e' troppo grande. Riprova con una foto piu' piccola o uno screenshot." };
  }

  const consumo = await consumaLetturaAssistita(supabase, tenantId);
  if (!consumo.ok) return consumo;

  const esito = await leggiRubricaDaFoto({ base64, tipo: immagine.tipo as TipoImmagineImport }, { tenantId });
  if (!esito.ok) return esito;

  const esistenti = await elencaClienti(tenantId, { perExport: true });
  if (esistenti.errore) {
    return { ok: false, errore: `Non riesco a leggere la rubrica attuale: ${esistenti.errore}` };
  }
  const diff = calcolaDiffImport(
    esistenti.clienti.map((c) => ({ id: c.id, nome: c.nome, telefono: c.telefono, email: c.email })),
    { clienti: esito.esito.proposte, scartate: [] }
  );
  const proposte = [...diff.nuovi, ...diff.giaPresenti].map((r) => ({ ...r, propostoDallAi: true }));
  return {
    ok: true,
    proposte,
    nonLette: esito.esito.nonLette,
    nonEUnaRubrica: esito.esito.nonEUnaRubrica,
    rimaste: consumo.rimasti,
    aVita: consumo.aVita,
  };
}

export type RisultatoImport =
  | { ok: true; creati: number; completati: number }
  | { ok: false; errore: string };

/**
 * Scrive SOLO le righe confermate. Non aggiorna i clienti gia' presenti
 * nemmeno quando l'incolla porta un nome diverso: sovrascrivere un nome che
 * il salone puo' aver corretto a mano, con uno preso da un file vecchio,
 * sarebbe un danno silenzioso. Chi vuole cambiarli lo fa dalla scheda.
 */
export async function applicaImportAzione(
  righe: RigaImport[],
  completamenti: RigaImport[] = []
): Promise<RisultatoImport> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };

  if (!Array.isArray(righe)) righe = [];
  if (!Array.isArray(completamenti)) completamenti = [];
  if (righe.length === 0 && completamenti.length === 0) {
    return { ok: false, errore: "Nessun cliente selezionato." };
  }
  if (righe.length + completamenti.length > MAX_RIGHE_IMPORT) {
    return { ok: false, errore: `Troppi clienti in una volta: il massimo e' ${MAX_RIGHE_IMPORT}.` };
  }

  // Non ci si fida di quello che torna dal browser: si ricontrolla che ogni
  // riga abbia un numero utilizzabile e si scartano quelle che dicono di
  // corrispondere a un cliente gia' esistente.
  const daCreare = righe
    .filter((r) => !r.esistenteId && telefonoUtilizzabile(r.telefono))
    .map((r) => ({
      nome: r.nome?.trim() || null,
      telefono: r.telefono.trim(),
      email: r.email?.trim() || null,
      note: r.note?.trim() || null,
    }));

  // I completamenti: SOLO clienti gia' presenti, SOLO i campi vuoti. Il
  // "solo se vuoto" lo applica la query, riga per riga (vedi
  // completaClienteDoveVuoto): quello che arriva dal browser dice cosa il
  // titolare ha spuntato, non cosa e' vuoto adesso nel database.
  const daCompletare = completamenti
    .filter((r) => r.esistenteId && telefonoUtilizzabile(r.telefono))
    .map((r) => ({ id: r.esistenteId as string, campi: campiDaCompletare(r) }))
    .filter((c) => c.campi.nome !== undefined || c.campi.email !== undefined);

  if (daCreare.length === 0 && daCompletare.length === 0) {
    return { ok: false, errore: "Niente da importare fra le righe selezionate." };
  }

  let creati = 0;
  if (daCreare.length > 0) {
    const esito = await creaClientiInBlocco(accesso.tenantId, daCreare);
    if (esito.errore) return { ok: false, errore: esito.errore };
    creati = esito.creati;
  }

  let completati = 0;
  for (const c of daCompletare) {
    const esito = await completaClienteDoveVuoto(accesso.tenantId, c.id, c.campi);
    if (esito.errore) return { ok: false, errore: esito.errore };
    if (esito.scritti > 0) completati += 1;
  }

  revalidatePath("/dashboard/clienti");
  return { ok: true, creati, completati };
}
