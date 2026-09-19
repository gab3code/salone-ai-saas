"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La forma minima di un campo che si puo' confrontare con il suo valore di
 * partenza. E' un sottoinsieme di HTMLInputElement/HTMLTextAreaElement, e la
 * funzione qui sotto lavora su questo e non sul DOM per poter essere provata
 * in Node senza un browser finto.
 */
export type CampoConfrontabile = {
  type: string;
  value: string;
  defaultValue: string;
  checked: boolean;
  defaultChecked: boolean;
};

/** Un campo e' "modificato" se quello che contiene non e' quello con cui e' nato. */
export function campoModificato(campo: CampoConfrontabile): boolean {
  if (campo.type === "checkbox" || campo.type === "radio") {
    return campo.checked !== campo.defaultChecked;
  }
  return campo.value !== campo.defaultValue;
}

/** Vero se ALMENO un campo differisce dal valore con cui il form e' stato renderizzato. */
export function haModificheNonSalvate(campi: Iterable<CampoConfrontabile>): boolean {
  for (const campo of campi) {
    if (campoModificato(campo)) return true;
  }
  return false;
}

/**
 * Legge il form vero e lo riduce ai campi confrontabili. Un <select> non ha
 * `defaultValue`: si guarda opzione per opzione quale era selezionata
 * all'inizio, e lo si traduce nello stesso confronto degli altri campi.
 */
function campiDelForm(form: HTMLFormElement): CampoConfrontabile[] {
  const campi: CampoConfrontabile[] = [];
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement) {
      campi.push(el);
    } else if (el instanceof HTMLTextAreaElement) {
      campi.push({ type: "textarea", value: el.value, defaultValue: el.defaultValue, checked: false, defaultChecked: false });
    } else if (el instanceof HTMLSelectElement) {
      const cambiato = Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
      campi.push({ type: "select", value: cambiato ? "1" : "", defaultValue: "", checked: false, defaultChecked: false });
    }
  }
  return campi;
}

/**
 * Dice quando il form che lo contiene ha modifiche non ancora salvate.
 *
 * Esiste per il 19/09/2026 (27sexvicies in CLAUDE.md): Gabriel ha corretto a
 * mano l'orario del sabato, non ha premuto "Salva orari", e per un'ora ha
 * creduto che il salvataggio fosse rotto -- il form mostrava 09:00, il
 * database aveva ancora 00:00, e il calendario obbediva al database. Un
 * campo con dentro un valore diverso da quello in archivio e' identico a uno
 * salvato, e nessuno dei tre stati diceva quale era quello vero.
 *
 * Si mette DENTRO il form, vicino al bottone di salvataggio, e non chiede
 * niente al form: lo trova da solo (`closest("form")`) e confronta ogni campo
 * con il suo valore di partenza. I form della dashboard sono non controllati
 * (defaultValue/defaultChecked, si veda il commento sulla `key` degli orari in
 * page.tsx), quindi il browser conserva gia' il valore iniziale e non serve
 * duplicare nessuno stato: si guarda `value` contro `defaultValue`.
 *
 * Sparisce da solo in tutti i casi in cui i valori tornano quelli salvati:
 * l'utente rimette a posto il campo (evento input), il form viene azzerato
 * (evento reset, che React 19 emette dopo una server action), oppure i dati
 * cambiano davvero e il form viene rimontato dalla sua `key`.
 *
 * Il calcolo si fa anche al montaggio, non solo agli eventi: Firefox al
 * ricaricamento della pagina rimette nei campi quello che c'era prima, senza
 * emettere nessun evento -- ed e' esattamente un valore non salvato.
 */
export function AvvisoModificheNonSalvate({ messaggio = "Modifiche non salvate" }: { messaggio?: string }) {
  const ancora = useRef<HTMLSpanElement>(null);
  const [modificato, setModificato] = useState(false);

  useEffect(() => {
    const form = ancora.current?.closest("form");
    if (!form) return;

    const ricalcola = () => setModificato(haModificheNonSalvate(campiDelForm(form)));
    // L'evento reset arriva PRIMA che il browser rimetta i valori di partenza:
    // letto subito, il form sembrerebbe ancora modificato.
    const dopoReset = () => {
      setTimeout(ricalcola, 0);
    };

    ricalcola();
    form.addEventListener("input", ricalcola);
    form.addEventListener("change", ricalcola);
    form.addEventListener("reset", dopoReset);
    return () => {
      form.removeEventListener("input", ricalcola);
      form.removeEventListener("change", ricalcola);
      form.removeEventListener("reset", dopoReset);
    };
  }, []);

  return (
    <span ref={ancora} role="status" hidden={!modificato} className="text-xs text-amber-700">
      {modificato ? messaggio : null}
    </span>
  );
}
