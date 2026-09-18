"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anteprimaCambioPianoAction,
  cambiaPianoAction,
  cancellaAttivitaAction,
  riattivaAttivitaAction,
  riepilogoCancellazioneAction,
  provaSentryAction,
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
import type { AnteprimaCambioPiano, AzioneStripe } from "@/lib/stripe/cambio-piano.server";

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
  const [azioneStripe, setAzioneStripe] = useState<AzioneStripe>("nessuna");
  const [conguaglio, setConguaglio] = useState<Exclude<AzioneStripe, "nessuna">>("prossimo_rinnovo");
  const [anteprima, setAnteprima] = useState<AnteprimaCambioPiano | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, startTransition] = useTransition();
  const router = useRouter();

  const segnali = segnaliAttivita(riga);
  const ricavo = ricavoMensileStimatoCentesimi(riga);

  function esegui(azione: () => Promise<{ errore?: string; messaggio?: string } | undefined>) {
    setErrore(null);
    setMessaggio(null);
    startTransition(async () => {
      const esito = await azione();
      if (esito?.errore) setErrore(esito.errore);
      else {
        setPannello("chiuso");
        setMotivo("");
        setNomeDigitato("");
        setAzioneStripe("nessuna");
        setAnteprima(null);
        if (esito?.messaggio) setMessaggio(esito.messaggio);
        router.refresh();
      }
    });
  }

  function scegliPiano(nuovoPiano: string) {
    setPiano(nuovoPiano);
    // Un'anteprima calcolata su un altro piano non vale più: lasciarla a
    // schermo farebbe confermare cifre che non c'entrano.
    setAnteprima(null);
  }

  function caricaAnteprima() {
    setErrore(null);
    setAnteprima(null);
    startTransition(async () => {
      const esito = await anteprimaCambioPianoAction(riga.tenantId, piano);
      if ("errore" in esito) setErrore(esito.errore);
      else setAnteprima(esito);
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
        <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Piano</label>
              <select
                aria-label="Piano"
                value={piano}
                onChange={(e) => scegliPiano(e.target.value)}
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
                aria-label="Stato"
                value={stato}
                disabled={azioneStripe !== "nessuna"}
                onChange={(e) => setStato(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {STATI_ABBONAMENTO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs text-zinc-500">Cosa fare su Stripe</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                aria-label="Solo qui"
                name={`stripe-${riga.tenantId}`}
                checked={azioneStripe === "nessuna"}
                onChange={() => {
                  setAzioneStripe("nessuna");
                  setAnteprima(null);
                }}
                className="mt-1"
              />
              <span>
                Solo qui
                <span className="block text-xs text-zinc-500">
                  L&apos;abbonamento su Stripe resta com&apos;è. Il piano diventa manuale e i webhook
                  smettono di aggiornarlo.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                aria-label="Aggiorna anche Stripe"
                name={`stripe-${riga.tenantId}`}
                checked={azioneStripe !== "nessuna"}
                onChange={() => setAzioneStripe(conguaglio)}
                className="mt-1"
              />
              <span>
                Aggiorna anche l&apos;abbonamento su Stripe
                <span className="block text-xs text-zinc-500">
                  Cambia davvero quello che il cliente paga. Prima di applicare ti mostro le cifre.
                </span>
              </span>
            </label>
          </fieldset>

          {azioneStripe !== "nessuna" && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {!anteprima ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={inCorso}
                    onClick={caricaAnteprima}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {inCorso ? "Leggo Stripe..." : `Vedi cosa cambia passando a ${piano}`}
                  </button>
                  <span className="text-xs text-zinc-500">
                    Finché non l&apos;hai letto, non si applica niente.
                  </span>
                </div>
              ) : !anteprima.possibile ? (
                <p className="text-xs text-zinc-600">{anteprima.motivo}</p>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ElencoRighe titolo="Adesso paga" righe={anteprima.righeAttuali} />
                    <ElencoRighe
                      titolo={anteprima.chiudeAbbonamento ? "Dopo" : "Pagherebbe"}
                      righe={anteprima.righeFuture}
                      vuoto={anteprima.chiudeAbbonamento ? "niente" : "nessuna riga"}
                    />
                  </div>

                  <p className="text-zinc-700">
                    {formatoEuroDaCentesimi(anteprima.totaleAttualeCentesimi)} al mese →{" "}
                    <span className="font-medium">
                      {formatoEuroDaCentesimi(anteprima.totaleFuturoCentesimi)}
                    </span>{" "}
                    <span className="text-zinc-500">
                      (calcolato su {anteprima.operatori}{" "}
                      {anteprima.operatori === 1 ? "operatore" : "operatori"})
                    </span>
                  </p>

                  {anteprima.chiudeAbbonamento && (
                    <p className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-900">
                      Il piano {piano} non ha un prezzo di listino: l&apos;abbonamento verrà chiuso
                      alla fine del periodo già pagato, non subito. Fino ad allora il servizio resta
                      attivo e la chiusura si può ancora annullare.
                    </p>
                  )}

                  {anteprima.aumenta && (
                    <p className="rounded-md bg-red-50 px-2 py-1.5 text-red-900">
                      Questo cambio fa pagare di più al cliente. Un aumento va concordato con lui
                      prima: questo pulsante non è il posto dove nasce il suo consenso.
                    </p>
                  )}

                  {!anteprima.chiudeAbbonamento && (
                    <fieldset className="flex flex-col gap-1 pt-1">
                      <legend className="text-zinc-500">Quando</legend>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name={`conguaglio-${riga.tenantId}`}
                          checked={conguaglio === "prossimo_rinnovo"}
                          onChange={() => {
                            setConguaglio("prossimo_rinnovo");
                            setAzioneStripe("prossimo_rinnovo");
                          }}
                        />
                        Dal prossimo rinnovo, senza conguagli
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name={`conguaglio-${riga.tenantId}`}
                          checked={conguaglio === "subito"}
                          onChange={() => {
                            setConguaglio("subito");
                            setAzioneStripe("subito");
                          }}
                        />
                        Subito, con conguaglio sulla prossima fattura
                      </label>
                    </fieldset>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={inCorso || (azioneStripe !== "nessuna" && !anteprima?.possibile)}
              onClick={() =>
                esegui(() => cambiaPianoAction(riga.tenantId, piano, stato, azioneStripe))
              }
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {inCorso ? "Salvo..." : azioneStripe === "nessuna" ? "Applica solo qui" : "Applica su Stripe"}
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
          </div>
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
      {messaggio && <p className="mt-2 text-xs text-emerald-700">{messaggio}</p>}
    </li>
  );
}

function ElencoRighe({
  titolo,
  righe,
  vuoto = "nessuna riga",
}: {
  titolo: string;
  righe: { descrizione: string; quantita: number; centesimiMese: number }[];
  vuoto?: string;
}) {
  return (
    <div>
      <p className="text-zinc-500">{titolo}</p>
      {righe.length === 0 ? (
        <p className="text-zinc-700">{vuoto}</p>
      ) : (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {righe.map((r, i) => (
            <li key={`${r.descrizione}-${i}`} className="text-zinc-700">
              {r.descrizione}
              {r.quantita > 1 && ` ×${r.quantita}`} · {formatoEuroDaCentesimi(r.centesimiMese)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Il bottone che verifica la diagnostica.
 *
 * La diagnostica e' l'unico strumento che, rotto, non da' nessun segno: il
 * silenzio e' anche il risultato che ci si aspetta quando tutto va bene. Una
 * variabile persa in un deploy si scoprirebbe il giorno in cui serve.
 */
function ProvaDiagnostica() {
  const [esito, setEsito] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function prova() {
    setInCorso(true);
    setEsito(null);
    const risultato = await provaSentryAction();
    setInCorso(false);
    setEsito(risultato.errore ?? `Segnalazione inviata (${risultato.id ?? "senza id"}).`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={prova}
        disabled={inCorso}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-50"
      >
        {inCorso ? "Invio..." : "Prova la diagnostica errori"}
      </button>
      {esito && <span className="text-zinc-600">{esito}</span>}
    </div>
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
        <ProvaDiagnostica />
      </div>
      {/* data-testid, non una classe: il registro degli interventi qui sotto è
          fatto anche lui di <li> che contengono il nome di un'attività, e un
          selettore per testo li pescherebbe entrambi (visto dal vivo il
          17/09/2026: gli scenari 20 e 21 hanno smesso di passare appena il
          registro ha cominciato a riempirsi). */}
      <ul data-testid="elenco-attivita" className="flex flex-col gap-3">
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
