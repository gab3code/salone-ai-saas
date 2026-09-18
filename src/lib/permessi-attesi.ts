/**
 * Cosa DOVREBBE permettere il database, secondo le migrazioni.
 *
 * Nasce da due incidenti nello stesso giorno, in direzioni opposte:
 *
 *  - la 0030: certe revoche esistevano SOLO in produzione, fatte a mano e
 *    mai scritte in un file. Ricostruendo il database dal repo sarebbe nato
 *    spalancato, e nessuno se ne sarebbe accorto.
 *  - la 0051: la revoca esisteva nel file e nel database di test, ma in
 *    produzione no -- per ore, con il codice gia' online. Il prodotto
 *    funzionava benissimo: quel permesso non lo usa piu' nessuno, quindi
 *    toglierlo o lasciarlo non cambia niente di visibile. Cambia solo chi
 *    puo' scaricarsi la rubrica saltando l'applicazione.
 *
 * Nessun test poteva accorgersene: i test girano sul database di TEST, che
 * era giusto. L'unico modo e' confrontare esplicitamente due cose che
 * nessuno confronta mai -- quello che i file dichiarano e quello che il
 * database vivo concede.
 *
 * Questo file fa la prima meta': legge le migrazioni e calcola lo stato
 * finale dei permessi. E' tutto puro, quindi testabile senza database.
 * La seconda meta' (leggere il database vero) sta in
 * scripts/confronta-permessi.mjs.
 *
 * LA REGOLA CHE HA MORSO DAVVERO, ed e' modellata qui sotto: un REVOKE sulla
 * TABELLA porta via anche i grant di COLONNA. Nella prima versione della
 * 0049 questo annullava la 0030, e il titolare non poteva piu' cambiare
 * nemmeno il nome del proprio salone. Se un domani qualcuno semplifica
 * questo file, e' la riga da non semplificare.
 */

export type Privilegio = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE" | "REFERENCES" | "TRIGGER";

const PRIVILEGI: readonly Privilegio[] = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
];

/** I permessi di un ruolo su una tabella: quelli pieni e quelli per colonna. */
export interface PermessiTabella {
  tabella: Set<Privilegio>;
  /** privilegio -> colonne su cui e' concesso solo per quelle colonne */
  colonne: Map<Privilegio, Set<string>>;
}

export type StatoPermessi = Map<string, PermessiTabella>;

export function chiave(tabella: string, ruolo: string): string {
  return `${tabella}|${ruolo}`;
}

function vuoti(): PermessiTabella {
  return { tabella: new Set(), colonne: new Map() };
}

function leggiPrivilegi(elenco: string): Privilegio[] {
  const pulito = elenco.trim().toLowerCase();
  if (pulito === "all" || pulito.startsWith("all privileges")) return [...PRIVILEGI];
  return pulito
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p): p is Privilegio => (PRIVILEGI as readonly string[]).includes(p));
}

function leggiRuoli(elenco: string): string[] {
  return elenco
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/** `create table ... public.nome` / `create table nome` -> nome */
export function tabelleDichiarate(sql: string): string[] {
  const trovate = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) trovate.add(m[1].toLowerCase());
  return [...trovate];
}

interface Istruzione {
  tipo: "grant" | "revoke";
  privilegi: Privilegio[];
  colonne: string[] | null;
  bersaglio: { tipo: "tabella"; nome: string } | { tipo: "tutte" };
  ruoli: string[];
}

/**
 * Riconosce solo le istruzioni sulle TABELLE. Quelle su funzioni, sequenze e
 * schema esistono nelle migrazioni e vengono ignorate di proposito: hanno
 * semantiche diverse e confonderle darebbe un confronto sbagliato, che e'
 * peggio di nessun confronto.
 */
export function leggiIstruzioni(sql: string): Istruzione[] {
  const senzaCommenti = sql.replace(/--[^\n]*/g, " ");

  // `alter default privileges ... revoke select on tables from anon;` NON e'
  // un permesso su una tabella: e' una regola su quelle che verranno. Senza
  // toglierla di mezzo, la ricerca qui sotto ci legge dentro un bersaglio
  // chiamato "tables" e si inventa una tabella che non esiste. Finora era
  // innocua (una tabella fantasma con zero privilegi combacia con il nulla
  // che c'e' in produzione), ma un controllo che tiene in pancia dati finti
  // e' un controllo che prima o poi dira' una bugia.
  const senzaDefault = senzaCommenti.replace(/alter\s+default\s+privileges[^;]*;/gi, " ");

  const istruzioni: Istruzione[] = [];

  // `[^;]` e non `[\s\S]`: il punto e virgola chiude un'istruzione, e senza
  // quel confine la ricerca puo' SCAVALCARLO.
  //
  // E' successo davvero, ed e' stato il primo confronto vero a scoprirlo
  // (18/09/2026): `grant usage on schema public to anon, authenticated;` non
  // combacia con nessun bersaglio valido, quindi la ricerca allungava la
  // parte dei privilegi fino a trovare l'`on` dell'istruzione SUCCESSIVA --
  // `grant select, ... on public.tenants to authenticated;` -- e produceva
  // un'unica corrispondenza che conteneva la parola "schema". Il filtro la
  // scartava come se fosse un permesso sullo schema, e il grant su `tenants`
  // spariva dal calcolo: il confronto denunciava un permesso di troppo in
  // produzione che invece era dichiarato da sempre nella 0005.
  //
  // Un controllo che grida al lupo e' peggio di nessun controllo: si smette
  // di credergli proprio il giorno in cui ha ragione.
  const re =
    /\b(grant|revoke)\s+([^;]*?)\s+on\s+(all\s+tables\s+in\s+schema\s+public|(?:table\s+)?(?:public\.)?"?[a-z0-9_]+"?)\s+(?:to|from)\s+([^;]+);/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(senzaDefault)) !== null) {
    const [, verbo, partePrivilegi, parteBersaglio, parteRuoli] = m;

    // `on all tables in schema public` contiene la parola "schema" ma e'
    // proprio l'istruzione che ci interessa di piu': va riconosciuta PRIMA
    // del filtro qui sotto, altrimenti la si scarta insieme ai grant sulle
    // funzioni. (Trovato dal test, non a occhio: senza, le revoche della
    // 0049 sparivano dal calcolo e il confronto avrebbe dato per buono un
    // database spalancato.)
    const eTutteLeTabelle = /all\s+tables/i.test(parteBersaglio);

    // `grant ... on function|sequence|schema ...`: non e' affar nostro.
    if (!eTutteLeTabelle && /\b(function|sequence|schema)\b/i.test(parteBersaglio)) continue;
    if (/\b(function|sequence|schema)\b/i.test(partePrivilegi)) continue;

    // Grant di colonna: `update (nome, slug)`.
    const conColonne = /^([a-z, ]+?)\s*\(([^)]*)\)$/i.exec(partePrivilegi.trim());
    const privilegi = leggiPrivilegi(conColonne ? conColonne[1] : partePrivilegi);
    if (privilegi.length === 0) continue;

    const colonne = conColonne
      ? conColonne[2].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
      : null;

    const bersaglio: Istruzione["bersaglio"] = eTutteLeTabelle
      ? { tipo: "tutte" }
      : {
          tipo: "tabella",
          nome: parteBersaglio
            .replace(/table\s+/i, "")
            .replace(/public\./i, "")
            .replace(/"/g, "")
            .trim()
            .toLowerCase(),
        };

    istruzioni.push({
      tipo: verbo.toLowerCase() as "grant" | "revoke",
      privilegi,
      colonne,
      bersaglio,
      ruoli: leggiRuoli(parteRuoli),
    });
  }

  return istruzioni;
}

/**
 * Applica le migrazioni NELL'ORDINE e restituisce lo stato finale atteso.
 * `migrazioni` arriva gia' ordinata per numero (0001, 0002, ...): l'ordine e'
 * il punto, un grant e una revoca sulla stessa cosa danno risultati opposti
 * a seconda di chi viene dopo.
 */
export function permessiAttesi(migrazioni: string[], ruoliDiInteresse: string[]): StatoPermessi {
  const sqlCompleto = migrazioni.join("\n");
  const tabelle = tabelleDichiarate(sqlCompleto);
  const stato: StatoPermessi = new Map();

  const prendi = (tabella: string, ruolo: string): PermessiTabella => {
    const k = chiave(tabella, ruolo);
    let p = stato.get(k);
    if (!p) {
      p = vuoti();
      stato.set(k, p);
    }
    return p;
  };

  for (const migrazione of migrazioni) {
    for (const istruzione of leggiIstruzioni(migrazione)) {
      const bersagli =
        istruzione.bersaglio.tipo === "tutte" ? tabelle : [istruzione.bersaglio.nome];

      for (const tabella of bersagli) {
        for (const ruolo of istruzione.ruoli) {
          if (!ruoliDiInteresse.includes(ruolo)) continue;
          const permessi = prendi(tabella, ruolo);

          for (const privilegio of istruzione.privilegi) {
            if (istruzione.tipo === "grant") {
              if (istruzione.colonne) {
                const attuali = permessi.colonne.get(privilegio) ?? new Set<string>();
                for (const colonna of istruzione.colonne) attuali.add(colonna);
                permessi.colonne.set(privilegio, attuali);
              } else {
                permessi.tabella.add(privilegio);
              }
            } else if (istruzione.colonne) {
              const attuali = permessi.colonne.get(privilegio);
              if (attuali) for (const colonna of istruzione.colonne) attuali.delete(colonna);
            } else {
              // LA RIGA DA NON SEMPLIFICARE: una revoca sulla tabella porta
              // via anche i permessi di colonna dello stesso privilegio.
              permessi.tabella.delete(privilegio);
              permessi.colonne.delete(privilegio);
            }
          }
        }
      }
    }
  }

  return stato;
}

export interface Divergenza {
  tabella: string;
  ruolo: string;
  privilegio: Privilegio;
  atteso: boolean;
  reale: boolean;
}

/**
 * Il confronto vero e proprio. `reali` arriva dal database vivo.
 *
 * Si guardano solo i privilegi che cambiano qualcosa per la sicurezza:
 * TRUNCATE, REFERENCES e TRIGGER restano addosso ai ruoli anche dopo le
 * nostre revoche (sono nei default di Supabase) e non permettono ne' di
 * leggere ne' di scrivere righe -- segnalarli produrrebbe solo rumore, e un
 * controllo rumoroso e' un controllo che si smette di leggere.
 */
export const PRIVILEGI_CHE_CONTANO: readonly Privilegio[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];

export function confronta(
  attesi: StatoPermessi,
  reali: StatoPermessi,
  tabelle: string[],
  ruoli: string[]
): Divergenza[] {
  const divergenze: Divergenza[] = [];

  for (const tabella of tabelle) {
    for (const ruolo of ruoli) {
      const a = attesi.get(chiave(tabella, ruolo)) ?? vuoti();
      const r = reali.get(chiave(tabella, ruolo)) ?? vuoti();

      for (const privilegio of PRIVILEGI_CHE_CONTANO) {
        // Un permesso di colonna vale come "concesso": chi puo' scrivere una
        // colonna puo' scrivere.
        const atteso = a.tabella.has(privilegio) || (a.colonne.get(privilegio)?.size ?? 0) > 0;
        const reale = r.tabella.has(privilegio) || (r.colonne.get(privilegio)?.size ?? 0) > 0;
        if (atteso !== reale) {
          divergenze.push({ tabella, ruolo, privilegio, atteso, reale });
        }
      }
    }
  }

  return divergenze;
}
