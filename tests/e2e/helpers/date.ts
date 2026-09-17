/**
 * Calcolo date per gli scenari E2E -- stessa semplificazione "fuso orario
 * trattato come giorno civile" già usata in tutto il booking engine (vedi
 * src/lib/fuso-orario.ts): un giorno YYYY-MM-DD interpretato con
 * `getUTCDay()` corrisponde al giorno della settimana che il salone vede
 * davvero, stessa convenzione di `orari_apertura.giorno_settimana`
 * (0 = domenica ... 6 = sabato, vedi NOMI_GIORNI in RevisioneBozzaOnboarding.tsx).
 *
 * Le date vengono passate all'AI in formato esplicito "DD/MM" invece di
 * espressioni relative ("lunedì prossimo") -- più facile da interpretare in
 * modo deterministico sia per l'AI sia per le asserzioni del test, ed evita
 * ambiguità nei giorni a cavallo di un weekend.
 */

import { realeAPseudoUtc, FUSO_ORARIO_PREDEFINITO } from "@/lib/fuso-orario";

export interface GiornoDiProva {
  data: Date; // mezzanotte UTC del giorno scelto
  ymd: string; // "YYYY-MM-DD"
  giornoSettimana: number; // 0 = domenica ... 6 = sabato
  etichettaGiornoMese: string; // "DD/MM", da usare nel messaggio scritto all'AI
}

function costruisciGiorno(data: Date): GiornoDiProva {
  const ymd = data.toISOString().slice(0, 10);
  const giorno = String(data.getUTCDate()).padStart(2, "0");
  const mese = String(data.getUTCMonth() + 1).padStart(2, "0");
  return { data, ymd, giornoSettimana: data.getUTCDay(), etichettaGiornoMese: `${giorno}/${mese}` };
}

/**
 * Il primo giorno, a partire da domani, il cui `giorno_settimana` NON è tra
 * quelli chiusi -- di default nei tenant di prova (vedi tenant-di-prova.ts)
 * solo la domenica (0) è chiusa, quindi "domani" basta quasi sempre; il
 * ciclo esiste solo per non rompersi se un test personalizza gli orari.
 */
export function prossimoGiornoAperto(giorniSettimanaChiusi: number[] = [0]): GiornoDiProva {
  // "Domani" per il SALONE, non domani in UTC (18/09/2026).
  //
  // Prima qui c'era `new Date()` letto con i getter UTC. Dalle 22:00 UTC in
  // poi -- cioe' da mezzanotte italiana -- quel calcolo restituiva il giorno
  // civile che per il salone era gia' OGGI, e l'helper smetteva di mantenere
  // la promessa scritta nel suo nome.
  //
  // Due scenari sono caduti la stessa notte per questo, in modi diversi e
  // per questo difficili da collegare: il 10 prenotava "domani alle 10:00"
  // che era in realta' oggi, finiva dentro le 24 ore di preavviso e trovava
  // il pulsante di cancellazione giustamente sparito; l'1 chiedeva all'AI di
  // prenotare per una data che per lei era oggi, e l'AI, invece di
  // prenotare, chiedeva conferma del giorno.
  //
  // Stessa convenzione pseudo-UTC del resto del progetto (fuso-orario.ts).
  const oggiSalone = realeAPseudoUtc(new Date(), FUSO_ORARIO_PREDEFINITO);
  const candidato = new Date(
    Date.UTC(oggiSalone.getUTCFullYear(), oggiSalone.getUTCMonth(), oggiSalone.getUTCDate() + 1)
  );
  for (let i = 0; i < 8; i++) {
    const g = costruisciGiorno(new Date(candidato.getTime() + i * 86_400_000));
    if (!giorniSettimanaChiusi.includes(g.giornoSettimana)) return g;
  }
  throw new Error("Nessun giorno aperto trovato nei prossimi 8 giorni -- controlla gli orari passati al test.");
}

/** Un secondo giorno aperto, diverso e successivo al primo -- utile per gli scenari di spostamento/conflitto. */
export function secondoGiornoAperto(giorniSettimanaChiusi: number[] = [0]): GiornoDiProva {
  const primo = prossimoGiornoAperto(giorniSettimanaChiusi);
  for (let i = 1; i < 9; i++) {
    const g = costruisciGiorno(new Date(primo.data.getTime() + i * 86_400_000));
    if (!giorniSettimanaChiusi.includes(g.giornoSettimana)) return g;
  }
  throw new Error("Nessun secondo giorno aperto trovato -- controlla gli orari passati al test.");
}
