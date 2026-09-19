"use client";

import type { FormEvent } from "react";

/**
 * SALVARE SENZA CHE REACT RIMETTA I CAMPI COM'ERANO.
 *
 * Misurato il 19/09/2026 con React 19.2.8 in isolamento, dopo tre segnalazioni
 * di Gabriel che sembravano tre bug diversi ed erano lo stesso:
 *
 *   spunta della caparra   prima: true   dopo il salvataggio: false
 *   radio del tono         prima: true   dopo il salvataggio: false
 *   select                 prima: "due"  dopo il salvataggio: "uno"
 *   testo / numero / textarea                              invariati
 *
 * `<form action={...}>` in React 19 **resetta il form** quando l'azione
 * finisce. Il reset riporta ogni campo al valore dell'HTML di partenza, e
 * `checked`/`selected` sono proprio i campi che il reset tocca: da qui la
 * spunta che "torna blu" quando la togli, e che resta bianca quando la metti.
 * Il testo e le textarea no -- ed e' esattamente l'asimmetria che Gabriel
 * aveva notato da solo ("il tono torna predefinito, la nota invece va").
 *
 * Perche' e' peggio di un difetto grafico: dopo il reset il DOM e lo stato
 * React dicono cose diverse, React non ri-renderizza (lo stato non e'
 * cambiato) e il salvataggio successivo manda al server **quello che c'e' nel
 * DOM**, non quello che l'utente crede di aver scelto.
 *
 * Cure provate e scartate, in ordine:
 *  - `key` sul componente per rimontarlo: rimonta e si porta via anche il
 *    messaggio di conferma (vedi 27untricies);
 *  - riallinearsi alla prop del server durante il render
 *    (`useAllineamentoAlServer`): giusto in se', ma non c'entra -- dopo il
 *    salvataggio lo stato e' gia' quello giusto, quindi non riallinea niente
 *    e il DOM resta resettato;
 *  - `defaultChecked` accanto a `checked`: React avvisa che l'input diventa
 *    meta' controllato e meta' no, e resetta lo stesso (misurato).
 *
 * Quello che funziona (misurato): non usare `action`, ma `onSubmit` con
 * `preventDefault`. Niente reset, lo stato React resta l'unica verita'.
 *
 * Si perde l'invio senza JavaScript, che in questi pannelli non esisteva
 * comunque: i campi sono controllati e alcuni si abilitano solo via stato.
 *
 * Uso:
 *
 *   <form onSubmit={alInvio(salva)}>
 */
export function alInvio(azione: (formData: FormData) => unknown) {
  return (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    // Stesso comportamento dell'attributo `action`: i campi disabilitati non
    // finiscono nel FormData (il codice che ci gira sopra lo da' gia' per
    // scontato, vedi pannello-contatti).
    void azione(new FormData(evento.currentTarget));
  };
}
