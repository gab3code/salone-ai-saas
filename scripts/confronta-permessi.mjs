/**
 * Confronta i permessi VERI di un database con quelli che le migrazioni
 * dichiarano, e dice dove divergono.
 *
 *   npm run permessi              -> il database di .env.local (produzione)
 *   npm run permessi -- --test    -> quello di .env.test
 *
 * Perche' esiste: il 18/09/2026 lo stesso errore e' successo due volte in
 * direzioni opposte. La 0030 era una revoca fatta a mano in produzione e mai
 * scritta in un file: ricostruendo il database dal repo sarebbe nato
 * spalancato. La 0051 era il contrario -- scritta nel file, applicata al
 * database di test, dimenticata in produzione per ore, con il codice gia'
 * online e il prodotto che funzionava benissimo, perche' quel permesso non lo
 * usa piu' nessuno. Cambiava solo chi poteva scaricarsi la rubrica clienti
 * saltando l'applicazione.
 *
 * Nessun test poteva trovarli: i test girano sul database di test, che era
 * giusto. Serve un confronto esplicito fra due cose che nessuno confronta.
 *
 * Esce con codice 1 se trova una divergenza, cosi' un domani si puo'
 * infilare in un controllo automatico senza riscriverlo.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as caricaEnv } from "dotenv";
import {
  chiave,
  confronta,
  permessiAttesi,
  tabelleDichiarate,
} from "../src/lib/permessi-attesi.ts";

const RUOLI = ["anon", "authenticated"];
const radice = join(dirname(fileURLToPath(import.meta.url)), "..");

const suTest = process.argv.includes("--test");
caricaEnv({ path: join(radice, ".env.local") });
if (suTest) caricaEnv({ path: join(radice, ".env.test"), override: true });

const url = suTest ? process.env.E2E_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiaveServizio = suTest
  ? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chiaveServizio) {
  console.error(
    suTest
      ? "Mancano E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY in .env.test."
      : "Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
  process.exit(2);
}

const migrazioni = readdirSync(join(radice, "supabase", "migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()
  .map((n) => readFileSync(join(radice, "supabase", "migrations", n), "utf8"));

const attesi = permessiAttesi(migrazioni, RUOLI);
const tabelle = tabelleDichiarate(migrazioni.join("\n")).sort();

const supabase = createClient(url, chiaveServizio, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: righe, error } = await supabase.rpc("permessi_correnti");

if (error) {
  console.error(`\nNon riesco a leggere i permessi: ${error.message}`);
  // Tre modi diversi di fallire, tre cose diverse da fare: dirlo evita di
  // andare a cercare una migrazione quando il problema e' la rete.
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)) {
    console.error(`Il database non e' raggiungibile da qui (${url}).\n`);
  } else if (/permessi_correnti|function|does not exist|schema cache/i.test(error.message)) {
    console.error("Manca la migrazione 0053 su QUESTO database: applicala e riprova.\n");
  } else {
    console.error("");
  }
  process.exit(2);
}

/** Le righe della funzione -> la stessa forma che usa il calcolo dai file. */
const reali = new Map();
for (const riga of righe ?? []) {
  const k = chiave(riga.tabella, riga.ruolo);
  let permessi = reali.get(k);
  if (!permessi) {
    permessi = { tabella: new Set(), colonne: new Map() };
    reali.set(k, permessi);
  }
  if (riga.colonna) {
    const colonne = permessi.colonne.get(riga.privilegio) ?? new Set();
    colonne.add(riga.colonna);
    permessi.colonne.set(riga.privilegio, colonne);
  } else {
    permessi.tabella.add(riga.privilegio);
  }
}

const divergenze = confronta(attesi, reali, tabelle, RUOLI);

const dove = suTest ? "database di TEST" : "PRODUZIONE";
console.log(`\nPermessi a confronto -- ${dove}`);
console.log(`${url}`);
console.log(`${migrazioni.length} migrazioni, ${tabelle.length} tabelle, ruoli: ${RUOLI.join(", ")}\n`);

if (divergenze.length === 0) {
  console.log("Nessuna divergenza: il database concede esattamente quello che i file dichiarano.\n");
  process.exit(0);
}

console.log(`${divergenze.length} divergenze:\n`);
for (const d of divergenze) {
  const riga = `  ${d.tabella}.${d.ruolo} -> ${d.privilegio}`;
  if (d.reale && !d.atteso) {
    console.log(`${riga}\n      il database lo CONCEDE, le migrazioni no -- permesso di troppo`);
  } else {
    console.log(`${riga}\n      le migrazioni lo dichiarano, il database no -- manca una migrazione`);
  }
}

console.log(
  "\nUn permesso di troppo vuol dire che una revoca non e' mai arrivata qui.\n" +
    "Un permesso mancante vuol dire che una migrazione non e' stata applicata.\n" +
    "In tutti e due i casi il prodotto puo' funzionare benissimo lo stesso.\n"
);
process.exit(1);
