/**
 * Cifra le credenziali dei calendari gia' salvate in chiaro.
 *
 *   npm run cifra-credenziali                 -> dice cosa farebbe, non scrive
 *   npm run cifra-credenziali -- --applica    -> scrive davvero
 *   npm run cifra-credenziali -- --test       -> sul database di test
 *
 * Da lanciare UNA VOLTA per database, dopo aver messo
 * SALONE_CHIAVE_CIFRATURA fra le variabili d'ambiente.
 *
 * Il codice nuovo cifra tutto quello che scrive e legge sia il cifrato sia il
 * chiaro (vedi src/lib/cifratura.ts), quindi senza questo script niente si
 * rompe -- ma le righe gia' esistenti restano in chiaro finche' qualcuno non
 * ricollega quel calendario. Cioe' il lavoro resta fatto a meta', ed e'
 * esattamente il tipo di meta' che ci si dimentica.
 *
 * Non stampa MAI il contenuto di un segreto: dice solo quante righe e quali
 * campi. Uno script che ti mostra la password che sta proteggendo ha appena
 * fatto il contrario del suo lavoro.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as caricaEnv } from "dotenv";
import { cifra, eCifrato, NOME_VARIABILE_CHIAVE } from "../src/lib/cifratura.ts";

const CAMPI = ["caldav_password", "google_access_token", "google_refresh_token"];

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const suTest = process.argv.includes("--test");
const applica = process.argv.includes("--applica");

caricaEnv({ path: join(radice, ".env.local") });
if (suTest) caricaEnv({ path: join(radice, ".env.test"), override: true });

const url = suTest ? process.env.E2E_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiaveServizio = suTest
  ? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chiaveServizio) {
  console.error("Mancano l'indirizzo del database o la service_role key.");
  process.exit(2);
}
if (!process.env[NOME_VARIABILE_CHIAVE]) {
  console.error(
    `\n${NOME_VARIABILE_CHIAVE} non configurata. Generane una e mettila in .env.local e su Vercel:\n` +
      `  openssl rand -base64 32\n`
  );
  process.exit(2);
}

const supabase = createClient(url, chiaveServizio, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: righe, error } = await supabase
  .from("collegamenti_calendario_esterni")
  .select(`id, ${CAMPI.join(", ")}`);

if (error) {
  console.error(`\nNon riesco a leggere i collegamenti: ${error.message}\n`);
  process.exit(2);
}

const dove = suTest ? "database di TEST" : "PRODUZIONE";
console.log(`\nCifratura credenziali calendari -- ${dove}`);
console.log(`${righe?.length ?? 0} collegamenti in tutto\n`);

let daCifrare = 0;
let cifrati = 0;
const conteggioPerCampo = Object.fromEntries(CAMPI.map((c) => [c, 0]));

for (const riga of righe ?? []) {
  const aggiornamento = {};
  for (const campo of CAMPI) {
    const valore = riga[campo];
    if (!valore || eCifrato(valore)) continue;
    aggiornamento[campo] = cifra(valore);
    conteggioPerCampo[campo] += 1;
  }

  if (Object.keys(aggiornamento).length === 0) continue;
  daCifrare += 1;

  if (!applica) continue;

  const { error: erroreScrittura } = await supabase
    .from("collegamenti_calendario_esterni")
    .update(aggiornamento)
    .eq("id", riga.id);

  if (erroreScrittura) {
    console.error(`  collegamento ${riga.id}: ERRORE -- ${erroreScrittura.message}`);
    continue;
  }
  cifrati += 1;
}

for (const campo of CAMPI) {
  if (conteggioPerCampo[campo] > 0) console.log(`  ${campo}: ${conteggioPerCampo[campo]} da cifrare`);
}

if (daCifrare === 0) {
  console.log("Niente da fare: tutto quello che c'e' e' gia' cifrato.\n");
  process.exit(0);
}

if (!applica) {
  console.log(`\n${daCifrare} collegamenti da cifrare. Niente e' stato scritto.`);
  console.log("Rilancia con --applica per farlo davvero.\n");
  process.exit(0);
}

console.log(`\n${cifrati} collegamenti cifrati su ${daCifrare}.`);
if (cifrati < daCifrare) {
  console.log("Qualcuno non e' passato: rilancia, e' sicuro farlo piu' volte.\n");
  process.exit(1);
}
console.log("Fatto. Rilanciare questo comando ora deve dire 'niente da fare'.\n");
