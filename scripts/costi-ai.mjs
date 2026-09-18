/**
 * Quanto e' costato far parlare l'assistente, con i dati veri.
 *
 *   npm run costi-ai              -> il database di .env.local (produzione)
 *   npm run costi-ai -- --test    -> quello di .env.test
 *   npm run costi-ai -- --giorni 7
 *
 * Legge la tabella `usi_api_ai` (migrazione 0068). Nasce il 19/09/2026 per
 * sostituire una stima con una misura: il conto a mano in DECISIONS.md si e'
 * rivelato sbagliato due volte, in due direzioni diverse, e non c'era modo
 * di accorgersene senza questi numeri.
 *
 * Cosa guardare per primo: `$ per messaggio del cliente`. E' l'unita' in cui
 * sono scritti i tetti dei piani in src/lib/ai/limiti.ts, quindi e' l'unico
 * numero che si moltiplica direttamente per un tetto e da' un margine.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as caricaEnv } from "dotenv";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const suTest = process.argv.includes("--test");
const iGiorni = process.argv.indexOf("--giorni");
const giorni = iGiorni >= 0 ? Number(process.argv[iGiorni + 1]) || 30 : 30;

caricaEnv({ path: join(radice, ".env.local") });
if (suTest) caricaEnv({ path: join(radice, ".env.test"), override: true });

const url = suTest ? process.env.E2E_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiaveServizio = suTest
  ? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chiaveServizio) {
  console.error("Mancano URL / SERVICE_ROLE_KEY nel file .env corrispondente.");
  process.exit(2);
}

const supabase = createClient(url, chiaveServizio, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const da = new Date(Date.now() - giorni * 24 * 3600 * 1000).toISOString();

const { data: righe, error } = await supabase
  .from("usi_api_ai")
  .select("tenant_id, canale, costo_microdollari, token_input, token_output, token_scrittura_cache, token_lettura_cache")
  .gte("creato_il", da)
  .limit(100000);

if (error) {
  console.error("Lettura fallita:", error.message);
  process.exit(1);
}

const dollari = (micro) => micro / 1_000_000;
const fmt = (n, cifre = 4) => n.toFixed(cifre);

console.log(`\nCosti AI -- ultimi ${giorni} giorni -- ${suTest ? "DATABASE DI PROVA" : "PRODUZIONE"}\n`);

if (!righe || righe.length === 0) {
  console.log("Nessuna chiamata registrata in questo periodo.");
  console.log("Se l'assistente e' stato usato e qui non c'e' niente, la misura non sta funzionando:");
  console.log("controlla che la migrazione 0068 sia applicata a QUESTO database.\n");
  process.exit(0);
}

const totale = righe.reduce((s, r) => s + r.costo_microdollari, 0);
const chiamate = righe.length;

console.log(`Chiamate al modello: ${chiamate}`);
console.log(`Costo totale:        $${fmt(dollari(totale), 4)}`);
console.log(`Per chiamata:        $${fmt(dollari(totale / chiamate), 6)}`);

// Per canale.
const perCanale = new Map();
for (const r of righe) {
  const c = perCanale.get(r.canale) ?? { chiamate: 0, micro: 0 };
  c.chiamate++;
  c.micro += r.costo_microdollari;
  perCanale.set(r.canale, c);
}
console.log("\nPer canale:");
for (const [canale, c] of [...perCanale].sort((a, b) => b[1].micro - a[1].micro)) {
  const quota = ((c.micro / totale) * 100).toFixed(1);
  console.log(`  ${canale.padEnd(18)} ${String(c.chiamate).padStart(6)} chiamate   $${fmt(dollari(c.micro), 4).padStart(10)}   ${quota.padStart(5)}%`);
}

// Dove finiscono i soldi: e' la domanda che decide se conviene accorciare il
// prompt, ridurre gli strumenti, o non toccare niente.
const somma = (campo) => righe.reduce((s, r) => s + r[campo], 0);
const tIn = somma("token_input");
const tOut = somma("token_output");
const tScr = somma("token_scrittura_cache");
const tLet = somma("token_lettura_cache");
console.log("\nToken (totali del periodo):");
console.log(`  input non in cache   ${tIn.toLocaleString("it-IT")}`);
console.log(`  output               ${tOut.toLocaleString("it-IT")}`);
console.log(`  scritti in cache     ${tScr.toLocaleString("it-IT")}`);
console.log(`  letti dalla cache    ${tLet.toLocaleString("it-IT")}`);
const risparmio = (tLet * (1.0 - 0.1)) / 1_000_000;
console.log(`  -> la cache ha fatto risparmiare circa $${fmt(risparmio, 4)} in questo periodo`);

// IL NUMERO CHE CONTA: i tetti dei piani sono scritti in messaggi del
// cliente, non in chiamate al modello. Un messaggio ne genera piu' d'una, e
// il rapporto fra le due cose e' proprio quello che una stima a mano
// sbaglia.
const chiamateClienti = righe.filter((r) => r.canale === "chat_web" || r.canale === "whatsapp").length;
const microClienti = righe
  .filter((r) => r.canale === "chat_web" || r.canale === "whatsapp")
  .reduce((s, r) => s + r.costo_microdollari, 0);

console.log("\nPer decidere i tetti dei piani:");
if (chiamateClienti === 0) {
  console.log("  Nessuna conversazione con clienti veri in questo periodo -- il dato non e' ancora utilizzabile.");
} else {
  const { count: messaggiClienti } = await supabase
    .from("messaggi")
    .select("id", { count: "exact", head: true })
    .eq("ruolo", "cliente")
    .gte("creato_il", da);

  if (!messaggiClienti) {
    console.log("  Nessun messaggio di cliente nel periodo: rapporto non calcolabile.");
  } else {
    const perMessaggio = dollari(microClienti) / messaggiClienti;
    console.log(`  Messaggi dei clienti:       ${messaggiClienti}`);
    console.log(`  Chiamate al modello:        ${chiamateClienti}  (${(chiamateClienti / messaggiClienti).toFixed(2)} per messaggio)`);
    console.log(`  $ PER MESSAGGIO DEL CLIENTE: $${fmt(perMessaggio, 5)}`);
    console.log("\n  Costo se un salone esaurisse il suo tetto:");
    for (const [nome, tetto, prezzo] of [
      ["Growth 1 operatore", 2500, 39.9],
      ["Growth 4 operatori", 4000, 84.9],
      ["Pro 1 operatore", 3000, 89.9],
      ["Pro 4 operatori", 12000, 149.9],
      ["Pro 10 operatori", 30000, 269.9],
    ]) {
      const costo = perMessaggio * tetto;
      const quota = ((costo / prezzo) * 100).toFixed(0);
      console.log(`    ${nome.padEnd(20)} ${String(tetto).padStart(6)} msg -> $${fmt(costo, 2).padStart(8)}  (~${quota}% di ${prezzo}€)`);
    }
  }
}

console.log("\nNota: campione piccolo = numero inaffidabile. Sotto qualche centinaio di");
console.log("chiamate vere, questi valori dicono poco piu' di una stima.\n");
