/**
 * Banco di prova per il riconoscimento dei messaggi offensivi.
 *
 * Non chiama nessun modello e non tocca il database: costa zero e si puo'
 * lanciare quante volte si vuole.
 *
 *   node --experimental-strip-types scripts/prova-messaggi-offensivi.mjs
 *   node --experimental-strip-types scripts/prova-messaggi-offensivi.mjs "una frase tua"
 *
 * Senza argomenti passa una lista di frasi di controllo e segnala solo le
 * differenze rispetto a quello che ci si aspetta. Con uno o piu' argomenti
 * prova quelle frasi li'.
 */
import { analizzaMessaggioOffensivo } from "../src/lib/ai/messaggio-offensivo.ts";

const ATTESI = [
  ["frocio", true],
  ["sei un frocio", true],
  ["f r o c i o", true],
  ["Fr0ci0", true],
  ["ma vaffanculo, il tuo salone fa schifo", true],
  ["stronzo", true],
  ["MERDA!!!", true],
  ["negro", true],
  ["troia", true],
  ["Vorrei taglio e piega insieme, con chi posso?", false],
  ["buongiorno, avete posto sabato mattina?", false],
  ["quanto costa la manicure?", false],
  ["scusa, ho fatto una cazzata, posso spostare l'appuntamento di domani?", false],
  ["sono il signor Negro, ho un appuntamento alle 15", false],
  ["buongiorno, sono di Troia in provincia di Foggia, fate la manicure?", false],
  ["mi consigliate spaghetti alla puttanesca dopo il taglio?", false],
  ["cerco un finocchio per la ricetta", false],
];

const argomenti = process.argv.slice(2);

if (argomenti.length > 0) {
  for (const frase of argomenti) {
    const esito = analizzaMessaggioOffensivo(frase);
    console.log(
      `${esito.offensivo ? "BLOCCATO" : "passa   "}  ${esito.motivo ? `[${esito.motivo}] ` : "      "} ${frase}`
    );
  }
  process.exit(0);
}

let sbagliate = 0;
for (const [frase, atteso] of ATTESI) {
  const esito = analizzaMessaggioOffensivo(frase).offensivo;
  if (esito !== atteso) {
    sbagliate += 1;
    console.log(
      `DIVERSO DALL'ATTESO: "${frase}" -> ${esito ? "bloccato" : "passa"}, ci si aspettava ${atteso ? "bloccato" : "passa"}`
    );
  }
}

console.log(
  sbagliate === 0
    ? `Tutte e ${ATTESI.length} le frasi di controllo si comportano come previsto.`
    : `${sbagliate} frasi su ${ATTESI.length} non si comportano come previsto.`
);
process.exit(sbagliate === 0 ? 0 : 1);
