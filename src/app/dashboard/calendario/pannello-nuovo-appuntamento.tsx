"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { creaAppuntamento } from "./azioni";
import { formattaGiornoEsteso } from "@/lib/data-italiana";
import type { MotivoOperatoriMancanti } from "@/lib/booking-engine";

interface Operatore {
  id: string;
  nome: string;
}

interface Servizio {
  id: string;
  nome: string;
  durataMinuti: number;
}

interface Slot {
  operatoreId: string;
  inizio: string; // ISO
}

/**
 * Pannello "nuovo appuntamento": scegliere servizi/operatore/data aggiorna
 * l'URL (query string) -> il Server Component della pagina ricalcola gli
 * slot veri con il motore di disponibilità e li passa qui come props. Niente
 * stato di disponibilità duplicato lato client: il client component gestisce
 * solo l'interazione (quale slot è selezionato, i campi del cliente), la
 * decisione "cosa è libero" resta sempre lato server (punto 14).
 *
 * Risponde direttamente a una debolezza osservata in Estetia (vedi
 * docs/analisi-estetia.md, "Primo slot disponibile in un click"): qui lo
 * slot si clicca, non si calcola a mente.
 *
 * Servizi consecutivi (punto 12, collegato il 16/09/2026): più caselle
 * selezionate = una catena di servizi con lo stesso operatore, senza buchi,
 * nell'ORDINE in cui compaiono nell'elenco (non nell'ordine di selezione --
 * più semplice da capire per lo staff che spuntare le caselle in un ordine
 * preciso).
 */
export function PannelloNuovoAppuntamento({
  operatori,
  servizi,
  slots,
  servizioIdsIniziali,
  operatoreIdIniziale,
  dataIniziale,
  giornoChiuso,
  motivoOperatori,
  provaAssistente,
}: {
  operatori: Operatore[];
  servizi: Servizio[];
  slots: Slot[];
  servizioIdsIniziali: string[];
  operatoreIdIniziale: string;
  dataIniziale: string;
  /** Il salone non apre in questo giorno: nessuna combinazione lo cambia. */
  giornoChiuso: boolean;
  /** Perche' nessun operatore puo' fare i servizi scelti, se e' il caso. */
  motivoOperatori: MotivoOperatoriMancanti | null;
  /**
   * Il riquadro "guarda cosa avrebbe risposto l'assistente" (Fase 5), gia'
   * costruito dalla pagina con i dati del tenant e passato qui come nodo:
   * questo componente non deve sapere niente di piani e quote, sa solo
   * QUANDO mostrarlo -- subito dopo un appuntamento inserito a mano, che e'
   * il momento in cui il titolare ha appena fatto il lavoro che
   * l'assistente gli toglierebbe. Assente sui piani che l'AI ce l'hanno
   * gia'.
   */
  provaAssistente?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [slotSelezionato, setSlotSelezionato] = useState<Slot | null>(null);
  const [erroreInvio, setErroreInvio] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [appenaCreato, setAppenaCreato] = useState(false);

  // Stato locale per le caselle servizio, invece di leggere `checked`
  // direttamente da `servizioIdsIniziali` (il prop che arriva dall'URL via il
  // Server Component). Bug reale trovato il 16/09/2026 lanciando gli scenari
  // E2E (Playwright: "Clicking the checkbox did not change its state" --
  // scoperto grazie al test, non a un controllo manuale): cliccare una
  // casella chiamava `setSlotSelezionato(null)` in modo sincrono, che
  // provocava un re-render IMMEDIATO con `servizioIdsIniziali` ancora
  // vecchio (la vera navigazione via `router.push` è asincrona) -- React
  // rimetteva quindi la checkbox a spenta un istante dopo che il click
  // l'aveva accesa, prima ancora che la navigazione finisse. Con uno stato
  // locale aggiornato subito al click, la casella risponde all'istante e
  // resta coerente quando poi l'URL si allinea.
  const [servizioIdsSelezionati, setServizioIdsSelezionati] = useState<string[]>(servizioIdsIniziali);
  // Riallineamento durante il render (pattern "adjusting state when a prop
  // changes" di React), non in un useEffect: evita un giro di render in più
  // e l'errore lint react-hooks/set-state-in-effect (setState sincrono
  // dentro un effetto).
  const [servizioIdsInizialiPrecedenti, setServizioIdsInizialiPrecedenti] = useState(servizioIdsIniziali);
  if (servizioIdsIniziali.join(",") !== servizioIdsInizialiPrecedenti.join(",")) {
    setServizioIdsInizialiPrecedenti(servizioIdsIniziali);
    setServizioIdsSelezionati(servizioIdsIniziali);
  }

  function aggiornaParametro(chiave: string, valore: string) {
    const parametri = new URLSearchParams(searchParams.toString());
    if (valore) {
      parametri.set(chiave, valore);
    } else {
      parametri.delete(chiave);
    }
    setSlotSelezionato(null);
    router.push(`/dashboard/calendario?${parametri.toString()}`);
  }

  /**
   * Perche' non c'e' nessun orario libero -- detto per davvero.
   *
   * Prima qui c'era una frase sola: "nessuno slot libero per questa
   * combinazione, prova un'altra data, un altro operatore o meno servizi
   * insieme". Vera in ogni caso e utile in nessuno: il 18/09/2026 il motivo
   * era un servizio senza operatore assegnato, e quei tre consigli mandavano
   * a cercare tutti e tre dalla parte sbagliata.
   *
   * L'ordine conta: si dice la causa che viene PRIMA. Se il salone e' chiuso,
   * di chi sa fare cosa non importa a nessuno.
   */
  function spiegazioneNessunoSlot(): ReactNode {
    if (giornoChiuso) {
      return (
        <>
          Il salone è chiuso in questo giorno: scegli un altro giorno qui sopra, oppure{" "}
          <a href="/dashboard/configura" className="underline">
            cambia gli orari di apertura
          </a>
          .
        </>
      );
    }

    if (motivoOperatori?.tipo === "servizi_senza_operatore") {
      const nomi = motivoOperatori.servizioIds
        .map((id) => servizi.find((s) => s.id === id)?.nome ?? id)
        .join(", ");
      // Due frasi diverse, non una con il soggetto scambiato: "nessun
      // operatore NON puo' fare" sarebbe una doppia negazione.
      const frase = operatoreIdIniziale
        ? `${operatori.find((o) => o.id === operatoreIdIniziale)?.nome ?? "L'operatore scelto"} non può fare`
        : "Nessun operatore può fare";
      return (
        <>
          {frase}: <strong>{nomi}</strong>.{" "}
          <a href="/dashboard/configura" className="underline">
            Assegna un operatore al servizio
          </a>
          {operatoreIdIniziale ? ", oppure scegli “Qualsiasi”." : "."}
        </>
      );
    }

    if (motivoOperatori?.tipo === "nessuno_copre_tutta_la_catena") {
      return (
        <>
          Nessun operatore può fare tutti i servizi scelti di seguito: i servizi consecutivi restano
          sulla stessa persona. Togline uno, oppure prenotali separatamente.
        </>
      );
    }

    return (
      <>
        La giornata è già piena, o la durata scelta non entra negli orari di apertura. Prova un altro
        giorno qui sopra, o meno servizi insieme.
      </>
    );
  }

  function alternaServizio(servizioId: string, selezionato: boolean) {
    const attuali = servizioIdsSelezionati.filter((id) => id !== servizioId);
    const nuovi = selezionato ? [...attuali, servizioId] : attuali;
    setServizioIdsSelezionati(nuovi);
    setSlotSelezionato(null);
    const parametri = new URLSearchParams(searchParams.toString());
    parametri.delete("servizio_id");
    for (const id of nuovi) parametri.append("servizio_id", id);
    router.push(`/dashboard/calendario?${parametri.toString()}`);
  }

  const servizioIdsSet = new Set(servizioIdsSelezionati);
  // Durata totale della catena selezionata (per mostrarla in chiaro allo
  // staff, prima ancora di vedere gli slot) -- stessa somma che il motore
  // di disponibilità calcola lato server.
  const durataTotaleMinuti = servizi
    .filter((s) => servizioIdsSet.has(s.id))
    .reduce((somma, s) => somma + s.durataMinuti, 0);

  const operatoriPerId = new Map(operatori.map((o) => [o.id, o.nome]));

  async function inviaForm(formData: FormData) {
    setInvioInCorso(true);
    setErroreInvio(null);
    const risultato = await creaAppuntamento(formData);
    setInvioInCorso(false);
    if (risultato?.errore) {
      setErroreInvio(risultato.errore);
    } else {
      setSlotSelezionato(null);
      setAppenaCreato(true);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded border border-zinc-200 p-4">
      <h2 className="text-base font-medium">Nuovo appuntamento</h2>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">
            Servizi {servizioIdsSelezionati.length > 1 && "(consecutivi, stesso operatore)"}
          </label>
          <div className="flex max-w-xs flex-col gap-1 rounded border border-zinc-300 px-2 py-1.5">
            {servizi.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={servizioIdsSet.has(s.id)}
                  onChange={(e) => alternaServizio(s.id, e.target.checked)}
                />
                {s.nome} ({s.durataMinuti} min)
              </label>
            ))}
          </div>
          {servizioIdsSelezionati.length > 1 && (
            <p className="text-xs text-zinc-500">Durata totale: {durataTotaleMinuti} min</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Operatore (opzionale)</label>
          <select
            value={operatoreIdIniziale}
            onChange={(e) => aggiornaParametro("operatore_id", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1"
          >
            <option value="">Qualsiasi</option>
            {operatori.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Il giorno NON si sceglie qui: si sceglie una volta sola in cima
            alla pagina. Due campi che scrivevano lo stesso parametro nell'URL
            si muovevano a vicenda, e sembrava un difetto invece che un solo
            valore visto due volte (18/09/2026). Qui si legge, e basta. */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Giorno</span>
          <p className="px-2 py-1 text-sm">{formattaGiornoEsteso(dataIniziale)}</p>
        </div>
      </div>

      {servizioIdsIniziali.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500">Orari liberi -- clicca per scegliere:</p>
          {slots.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">{spiegazioneNessunoSlot()}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((slot) => {
                const selezionato =
                  slotSelezionato?.inizio === slot.inizio &&
                  slotSelezionato?.operatoreId === slot.operatoreId;
                return (
                  <button
                    key={`${slot.operatoreId}-${slot.inizio}`}
                    type="button"
                    onClick={() => setSlotSelezionato(slot)}
                    className={
                      selezionato
                        ? "rounded bg-black px-3 py-1.5 text-xs text-white"
                        : "rounded border border-zinc-300 px-3 py-1.5 text-xs"
                    }
                  >
                    {new Date(slot.inizio).toISOString().slice(11, 16)}
                    {!operatoreIdIniziale && ` · ${operatoriPerId.get(slot.operatoreId) ?? ""}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {slotSelezionato && (
        <form action={inviaForm} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3">
          <input type="hidden" name="operatore_id" value={slotSelezionato.operatoreId} />
          {servizioIdsIniziali.map((id) => (
            <input key={id} type="hidden" name="servizio_id" value={id} />
          ))}
          <input type="hidden" name="inizio" value={slotSelezionato.inizio} />

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Cliente (nome)</label>
            <input
              name="cliente_nome"
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Cliente (telefono)</label>
            <input
              name="cliente_telefono"
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={invioInCorso}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {invioInCorso ? "Prenoto..." : "Conferma prenotazione"}
          </button>
        </form>
      )}

      {erroreInvio && <p className="text-sm text-red-600">{erroreInvio}</p>}

      {appenaCreato && provaAssistente}
    </div>
  );
}
