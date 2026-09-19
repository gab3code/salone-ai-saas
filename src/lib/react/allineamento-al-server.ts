"use client";

import { useState } from "react";

/**
 * ALLINEARE UN FORM AI VALORI DEL SERVER SENZA RIMONTARLO.
 *
 * Il problema, visto due volte il 19/09/2026 (caparra e tono dell'AI) e
 * presente in altri sette pannelli prima di questo file: `useState(propDalServer)`
 * legge la prop **una volta sola**, al montaggio. Dopo un salvataggio la pagina
 * si rigenera lato server con i valori nuovi, ma lo stato del form resta quello
 * di prima -- Gabriel salvava e vedeva la spunta tornare blu, o il tono tornare
 * a "predefinito", mentre nel database il valore giusto c'era gia'.
 *
 * La cura sbagliata, provata e scartata: una `key` sul componente. Rimonta, si',
 * ma butta via **tutto** lo stato, compresa la conferma verde appena mostrata --
 * cioe' ripara un difetto e ne introduce uno peggiore (vedi 27untricies).
 *
 * La cura giusta e' il pattern React "adjusting state when props change":
 * confrontare durante il render quello che il server dice ADESSO con quello che
 * diceva l'ultima volta, e se e' cambiato riallineare solo i campi interessati.
 * Il componente resta montato, il messaggio resta a schermo.
 *
 * Perche' un hook invece di nove copie: nove copie sono nove occasioni di
 * sbagliare un confronto, e la decima schermata nascerebbe di nuovo col difetto.
 * Qui il confronto e' uno solo, testato una volta sola.
 *
 * Il nome inizia con `use` come tutti gli hook del progetto
 * (`useRiflessoMetallico`, `useSpotlightScuro`): non e' inglese per vezzo, e'
 * la convenzione che React e il linter usano per riconoscere un hook.
 *
 * Uso:
 *
 *   useAllineamentoAlServer({ attivo: attivoIniziale, nota: notaIniziale }, (v) => {
 *     setAttivo(v.attivo);
 *     setNota(v.nota);
 *   });
 *
 * `applica` viene chiamata durante il render: deve contenere **solo** setState
 * del componente stesso (e' quello che React permette in questo pattern), mai
 * fetch, log o altri effetti.
 */
export function useAllineamentoAlServer<T extends Record<string, ValorePiatto>>(
  dalServer: T,
  applica: (valori: T) => void
): void {
  const [ultimoDalServer, setUltimoDalServer] = useState<T>(dalServer);
  if (!stessiValori(ultimoDalServer, dalServer)) {
    setUltimoDalServer(dalServer);
    applica(dalServer);
  }
}

type ValorePiatto = string | number | boolean | null | undefined;

/**
 * Confronto superficiale, chiave per chiave.
 *
 * Deve essere superficiale per forza: chi usa l'hook passa un oggetto letterale
 * costruito a ogni render (`{ attivo: attivoIniziale }`), quindi un confronto
 * per identita' direbbe "cambiato" sempre e il form si riallineerebbe a ogni
 * render, cancellando quello che l'utente sta scrivendo.
 *
 * `Object.is` e non `===` per NaN (un campo numerico vuoto puo' arrivare come
 * NaN, e `NaN === NaN` e' falso: basterebbe quello per un ciclo di render).
 */
export function stessiValori(
  a: Record<string, ValorePiatto>,
  b: Record<string, ValorePiatto>
): boolean {
  const chiaviA = Object.keys(a);
  const chiaviB = Object.keys(b);
  if (chiaviA.length !== chiaviB.length) return false;
  return chiaviA.every((chiave) => Object.is(a[chiave], b[chiave]));
}
