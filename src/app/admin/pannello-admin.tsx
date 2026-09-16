"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancellaAttivitaAction,
  impostaPianoManualeAction,
  riattivaAttivitaAction,
  riepilogoCancellazioneAction,
  riportaPianoSuStripeAction,
  sospendiAttivitaAction,
} from "./azioni";
import {
  PIANI_ASSEGNABILI,
  STATI_ABBONAMENTO,
  formatoEuroDaCentesimi,
  ricavoMensileStimatoCentesimi,
  segnaliAttivita,
  type RigaAdmin,
} from "@/lib/admin";
import type { RiepilogoCancellazione } from "@/lib/admin.server";

function formatoData(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Pannello = "chiuso" | "piano" | "sospendi" | "cancella";

function RigaAttivita({ riga }: { riga: RigaAdmin }) {
  const [pannello, setPannello] = useState<Pannello>("chiuso");
  const [piano, setPiano] = useState(riga.piano);
  const [stato, setStato] = useState(riga.statoAbbonamento);
  const [motivo, setMotivo] = useState("");
  const [nomeDigitato, setNomeDigitato] = useState("");
  const [riepilogo, setRiepilogo] = useState<RiepilogoCancellazione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, startTransition] = useTransition();
  const router = useRouter();

  const segnali = segnaliAttivita(riga);
  const ricavo = ricavoMensileStimatoCentesimi(riga);

  function esegui(azione: () => Promise<{ errore?: string } | undefined>) {
    setErrore(null);
    startTransition(async () => {
      const esito = await azione();
      if (esito?.errore) setErrore(esito.errore);
      else {
        setPannello("chiuso");
        setMotivo("");
        setNomeDigitato("");
        router.refresh();
      }
    });
  }

  function apriCancellazione() {
    setErrore(null);
    setPannello("cancella");
    setRiepilogo(null);
    startTransition(async () => {
      const esito = await riepilogoCancellazioneAction(riga.tenantId);
      if ("errore" in esito) setErrore(esito.errore);
      else setRiepilogo(esito);
    });
  }

  return (
    <li className={`rounded-2xl border bg-white p-4 ${riga.sospesa ? "border-amber-300" : "border-zinc-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-zinc-900">
            {riga.nome}
            <span className="ml-2 text-xs font-normal text-zinc-400">/s/{riga.slug}</span>
          </span>
          <span className="text-xs text-zinc-500">
            {riga.emailTitolari.join(", ") || "nessun titolare collegato"} · dal {formatoData(riga.creatoIl)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ricavo > 0 && (
            <span className="text-xs font-medium text-zinc-700">{formatoEuroDaCentesimi(ricavo)}/mese</span>
          )}
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{riga.piano}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{riga.statoAbbonamento}</span>
          {riga.pianoManuale && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
              title="Piano deciso a mano: il webhook Stripe non lo tocca"
            >
              manuale
            </span>
          )}
          {riga.sospesa && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">sospesa</span>
          )}
        </div>
      </div>

      {segnali.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {segnali.map((s) => (
            <li
              key={s.testo}
              className={`text-xs ${s.gravita === "alta" ? "text-red-700" : "text-amber-700"}`}
            >
              {s.testo}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span>{riga.membri} in team</span>
        <span>{riga.operatori} operatori</span>
        <span>{riga.servizi} servizi</span>
        <span>{riga.clienti} clienti</span>
        <span>
          {riga.appuntamenti} appuntamenti ({riga.appuntamenti30Giorni} negli ultimi 30gg,{" "}
          {riga.prenotazioniMeseCorrente} questo mese)
        </span>
        <span>{riga.haStripe ? "cliente Stripe collegato" : "nessun cliente Stripe"}</span>
      </div>

      {pannello === "chiuso" && (
        <div className="mt-3 flex flex-wrap gap-4">
          <button type="button" onClick={() => setPannello("piano")} className="text-xs underline">
            Intervieni sul piano
          </button>
          {riga.sospesa ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => esegui(() => riattivaAttivitaAction(riga.tenantId))}
              className="text-xs underline disabled:opacity-50"
            >
              Riattiva
            </button>
          ) : (
            <button type="button" onClick={() => setPannello("sospendi")} className="text-xs underline">
              Sospendi
            </button>
          )}
          <button type="button" onClick={apriCancellazione} className="text-xs text-red-600 underline">
            Cancella attività
          </button>
        </div>
      )}

      {riga.sospesa && riga.sospesaMotivo && pannello === "chiuso" && (
        <p className="mt-2 text-xs text-amber-800">Motivo: {riga.sospesaMotivo}</p>
      )}

      {pannello === "piano" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Piano</label>
            <select
              value={piano}
              onChange={(e) => setPiano(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {PIANI_ASSEGNABILI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Stato</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {STATI_ABBONAMENTO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={inCorso}
            onClick={() => esegui(() => impostaPianoManualeAction(riga.tenantId, piano, stato))}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Salvo..." : "Applica a mano"}
          </button>
          {riga.pianoManuale && (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => esegui(() => riportaPianoSuStripeAction(riga.tenantId))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Ridai il controllo a Stripe
            </button>
          )}
          <button type="button" onClick={() => setPannello("chiuso")} className="text-xs underline">
            Annulla
          </button>
          <p className="w-full text-xs text-zinc-500">
            Applicando a mano, il webhook Stripe smette di aggiornare piano e stato per questa attività
            finché non ridai il controllo.
          </p>
        </div>
      )}

      {pannello === "sospendi" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-zinc-500">Motivo della sospensione</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Es. abbonamento non pagato da 3 mesi"
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={inCorso}
            onClick={() => esegui(() => sospendiAttivitaAction(riga.tenantId, motivo))}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Sospendo..." : "Sospendi"}
          </button>
          <button type="button" onClick={() => setPannello("chiuso")} className="text-xs underline">
            Annulla
          </button>
          <p className="w-full text-xs text-zinc-500">
            La pagina pubblica smette di accettare prenotazioni. Il titolare continua a entrare in
            dashboard e a vedere la sua agenda, così può onorare gli appuntamenti già presi.
          </p>
        </div>
      )}

      {pannello === "cancella" && (
        <div className="mt-3 flex flex-col gap-3 border-t border-red-200 pt-3">
          {!riepilogo ? (
            <p className="text-xs text-zinc-500">Calcolo cosa verrebbe cancellato...</p>
          ) : (
            <>
              <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-900">
                  Stai per cancellare definitivamente {riepilogo.nome}.
                </p>
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-red-800">
                  <li>{riepilogo.clienti} clienti finali, con tutti i loro dati</li>
                  <li>{riepilogo.appuntamenti} appuntamenti e {riepilogo.recensioni} recensioni</li>
                  <li>La pagina pubblica /s/{riepilogo.slug} e le foto caricate</li>
                  {riepilogo.abbonamentoAttivo && <li>L&apos;abbonamento Stripe, che verrà cancellato</li>}
                  {riepilogo.accountDaCancellare.length > 0 ? (
                    <li>
                      {riepilogo.accountDaCancellare.length} account che non fanno parte di nessun&apos;altra
                      attività: {riepilogo.accountDaCancellare.join(", ")}
                    </li>
                  ) : (
                    <li>Nessun account verrà cancellato: chi ci lavora fa parte anche di altre attività</li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-red-800">Non si può annullare.</p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-zinc-500">
                    Scrivi <span className="font-medium text-zinc-800">{riepilogo.nome}</span> per confermare
                  </label>
                  <input
                    type="text"
                    value={nomeDigitato}
                    onChange={(e) => setNomeDigitato(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={inCorso || nomeDigitato.trim() !== riepilogo.nome}
                  onClick={() => esegui(() => cancellaAttivitaAction(riga.tenantId, nomeDigitato))}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {inCorso ? "Cancello..." : "Cancella per sempre"}
                </button>
                <button type="button" onClick={() => setPannello("chiuso")} className="text-xs underline">
                  Annulla
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {errore && <p className="mt-2 text-xs text-red-600">{errore}</p>}
    </li>
  );
}

export function PannelloAdmin({ righe }: { righe: RigaAdmin[] }) {
  const [filtro, setFiltro] = useState("");
  const [soloDaGuardare, setSoloDaGuardare] = useState(false);

  const visibili = righe.filter((riga) => {
    if (soloDaGuardare && segnaliAttivita(riga).length === 0) return false;
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      riga.nome.toLowerCase().includes(q) ||
      riga.slug.toLowerCase().includes(q) ||
      riga.piano.toLowerCase().includes(q) ||
      riga.emailTitolari.some((e) => e.toLowerCase().includes(q))
    );
  });

  const conSegnali = righe.filter((r) => segnaliAttivita(r).length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Cerca per nome, slug, piano o email"
          className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={soloDaGuardare}
            onChange={(e) => setSoloDaGuardare(e.target.checked)}
            className="size-4"
          />
          Solo quelle da guardare ({conSegnali})
        </label>
      </div>
      <ul className="flex flex-col gap-3">
        {visibili.map((riga) => (
          <RigaAttivita key={riga.tenantId} riga={riga} />
        ))}
        {visibili.length === 0 && (
          <li className="text-sm text-zinc-500">Nessuna attività corrisponde alla ricerca.</li>
        )}
      </ul>
    </div>
  );
}
