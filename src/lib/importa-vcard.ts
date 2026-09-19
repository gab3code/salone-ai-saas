import {
  leggiIncolla,
  telefonoCanonico,
  telefonoUtilizzabile,
  MAX_RIGHE_IMPORT,
  type ClienteImportato,
  type EsitoLettura,
} from "./importa-clienti";

/**
 * La rubrica del telefono, esportata come vCard (.vcf).
 *
 * E' "l'altro tipo di file" che un salone ha davvero: iPhone e Android
 * esportano i contatti in questo formato, e un vcf con trecento schede e'
 * il caso piu' frequente dopo l'Excel. Si legge senza modello, come il CSV:
 * il formato e' regolare (RFC 6350, e il vecchio 2.1 degli Android di dieci
 * anni fa), e un lettore deterministico da' sempre lo stesso risultato.
 *
 * Cosa si tiene di ogni scheda:
 *  - il nome: FN se c'e', se no N ("Cognome;Nome;...") ricomposto, se no ORG
 *    (un fornitore salvato con la sola ragione sociale e' comunque una scheda);
 *  - UN numero: il primo segnato cellulare/mobile, se no il primo
 *    utilizzabile. Le schede con piu' numeri sono comuni e il secondo non si
 *    perde: finisce nelle note, cosi' il titolare lo vede in revisione;
 *  - la prima email;
 *  - NOTE, se c'e'.
 *
 * Le schede senza un numero utilizzabile finiscono fra le scartate, con il
 * nome: si vedono, non spariscono (stessa regola di `leggiIncolla`).
 */

export function eVCard(testo: string): boolean {
  return /^\s*BEGIN:VCARD/im.test(testo ?? "");
}

/** Un file di testo dell'import: vCard se lo e', altrimenti CSV/incolla. */
export function leggiTestoImport(testo: string): EsitoLettura {
  return eVCard(testo) ? leggiVCard(testo) : leggiIncolla(testo);
}

interface Proprieta {
  nome: string;
  parametri: string[];
  valore: string;
}

/**
 * Le righe di una vCard vanno prima "spiegate": una riga lunga continua
 * sulla successiva con uno spazio o un tab iniziale (RFC), e nel vecchio
 * formato 2.1 con quoted-printable continua con un "=" finale.
 */
function spiegaRighe(testo: string): string[] {
  const grezze = testo.replace(/\r\n?/g, "\n").split("\n");
  const righe: string[] = [];
  for (const riga of grezze) {
    if (righe.length > 0 && /^[ \t]/.test(riga)) {
      righe[righe.length - 1] += riga.slice(1);
      continue;
    }
    const ultima = righe[righe.length - 1];
    if (ultima !== undefined && ultima.endsWith("=") && /QUOTED-PRINTABLE/i.test(ultima)) {
      righe[righe.length - 1] = ultima.slice(0, -1) + riga;
      continue;
    }
    righe.push(riga);
  }
  return righe.map((r) => r.trim()).filter((r) => r !== "");
}

function leggiProprieta(riga: string): Proprieta | null {
  const duePunti = riga.indexOf(":");
  if (duePunti === -1) return null;
  const testa = riga.slice(0, duePunti);
  const valore = riga.slice(duePunti + 1);
  const [nomeConGruppo, ...parametri] = testa.split(";");
  // "item1.TEL" -> "TEL": il gruppo e' un dettaglio dell'iPhone.
  const nome = nomeConGruppo.replace(/^[^.]*\./, "").toUpperCase();
  return { nome, parametri: parametri.map((p) => p.toUpperCase()), valore };
}

function decodificaQuotedPrintable(valore: string): string {
  const byte: number[] = [];
  const codificatore = new TextEncoder();
  for (let i = 0; i < valore.length; i++) {
    const c = valore[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(valore.slice(i + 1, i + 3))) {
      byte.push(parseInt(valore.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      byte.push(...Array.from(codificatore.encode(c)));
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(byte));
  } catch {
    return valore;
  }
}

function valoreDecodificato(p: Proprieta): string {
  const qp = p.parametri.some((par) => /ENCODING=QUOTED-PRINTABLE|^QUOTED-PRINTABLE$/.test(par));
  const grezzo = qp ? decodificaQuotedPrintable(p.valore) : p.valore;
  return grezzo.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function eCellulare(p: Proprieta): boolean {
  return p.parametri.some((par) => /CELL|MOBILE|IPHONE/.test(par));
}

function pulisciTelefono(valore: string): string {
  return valore.replace(/^tel:/i, "").trim();
}

function taglia(valore: string, max: number): string | null {
  const v = valore.trim().slice(0, max);
  return v === "" ? null : v;
}

function leggiScheda(righe: string[]): { cliente: ClienteImportato | null; descrizione: string } {
  let fn: string | null = null;
  let n: string | null = null;
  let org: string | null = null;
  let email: string | null = null;
  let note: string | null = null;
  const telefoni: { valore: string; cellulare: boolean }[] = [];

  for (const riga of righe) {
    const p = leggiProprieta(riga);
    if (!p) continue;
    const valore = valoreDecodificato(p);
    if (valore === "") continue;
    switch (p.nome) {
      case "FN":
        fn ??= valore;
        break;
      case "N": {
        // "Cognome;Nome;Secondo nome;Prefisso;Suffisso"
        const [cognome, nome, secondo] = valore.split(";").map((s) => s.trim());
        n ??= [nome, secondo, cognome].filter((s) => s).join(" ");
        break;
      }
      case "ORG":
        org ??= valore.split(";")[0].trim();
        break;
      case "TEL":
        telefoni.push({ valore: pulisciTelefono(valore), cellulare: eCellulare(p) });
        break;
      case "EMAIL":
        email ??= valore;
        break;
      case "NOTE":
        note ??= valore;
        break;
    }
  }

  const nome = taglia(fn ?? n ?? org ?? "", 200);
  const utilizzabili = telefoni.filter((t) => telefonoUtilizzabile(t.valore));
  const scelto = utilizzabili.find((t) => t.cellulare) ?? utilizzabili[0];
  const descrizione = nome ?? "(scheda senza nome)";
  if (!scelto) return { cliente: null, descrizione: `${descrizione}: nessun numero nella scheda` };

  const altri = utilizzabili
    .filter((t) => t !== scelto)
    .map((t) => t.valore)
    .filter((v, i, tutti) => tutti.findIndex((x) => telefonoCanonico(x) === telefonoCanonico(v)) === i)
    .filter((v) => telefonoCanonico(v) !== telefonoCanonico(scelto.valore));
  const noteComplete = [note, altri.length > 0 ? `Altro numero: ${altri.join(", ")}` : null]
    .filter((s): s is string => !!s)
    .join(" · ");

  return {
    cliente: {
      nome,
      telefono: scelto.valore.slice(0, 40),
      email: email && email.includes("@") ? taglia(email, 200) : null,
      note: taglia(noteComplete, 500),
    },
    descrizione,
  };
}

export function leggiVCard(testo: string): EsitoLettura {
  const righe = spiegaRighe(testo ?? "");
  const clienti: ClienteImportato[] = [];
  const scartate: string[] = [];
  const visti = new Set<string>();

  let scheda: string[] | null = null;
  for (const riga of righe) {
    if (/^BEGIN:VCARD$/i.test(riga)) {
      scheda = [];
      continue;
    }
    if (/^END:VCARD$/i.test(riga)) {
      if (scheda) {
        const { cliente, descrizione } = leggiScheda(scheda);
        if (!cliente) scartate.push(descrizione);
        else {
          const chiave = telefonoCanonico(cliente.telefono);
          if (!visti.has(chiave)) {
            visti.add(chiave);
            clienti.push(cliente);
          }
        }
      }
      scheda = null;
      if (clienti.length >= MAX_RIGHE_IMPORT) break;
      continue;
    }
    scheda?.push(riga);
  }

  return { clienti, scartate };
}
