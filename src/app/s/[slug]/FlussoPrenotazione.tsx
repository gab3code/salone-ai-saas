"use client";

import { useMemo, useState } from "react";
import type { ServizioPubblico, OperatorePubblico } from "@/lib/pagina-pubblica.server";
import { calcolaImportoCaparraCentesimi, type ConfigCaparra } from "@/lib/stripe/caparra";
import { importoCaparraPubblico } from "./azioni";
import { formatoEuroDaCentesimi as formatoEuro } from "@/lib/piani";
import {
  cercaSlotPubblici,
  prenotaPubblico,
  avviaPagamentoCaparra,
  iscrivitiListaAttesaPubblico,
  type SlotPubblico,
} from "./azioni";

/**
 * Flusso di prenotazione lato cliente (Fase 4, punto 15): servizio -> data ->
 * slot/operatore -> contatto -> conferma. Componente client perché la scelta
 * dello slot è interattiva (ricerca on-demand via server action, niente
 * ricaricamento pagina) -- stesso spirito del pannello calendario della
 * dashboard, ma pensato per un visitatore anonimo su mobile.
 *
 * Zero logica di disponibilità/prenotazione qui: ogni passo chiama le server
 * action in `./azioni.ts`, che a loro volta delegano SEMPRE al booking engine
 * condiviso (punto 9 di CLAUDE.md) -- questo componente si occupa solo di
 * raccogliere le scelte e mostrare il risultato.
 *
 * NOTA stile: stessa palette Tailwind (zinc neutro + bianco) già usata in
 * tutta la dashboard (vedi dashboard/clienti/[id]/page.tsx). Solo un po'
 * più "vestito" (rounded-2xl, ombre morbide,
 * spaziature più larghe) essendo una pagina rivolta al cliente finale, non
 * alla dashboard interna.
 */

type Passo = "servizio" | "data" | "slot" | "contatto" | "fatto";


function oggiYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Campo trappola anti-bot (vedi src/lib/anti-bot.ts): invisibile e
 * irraggiungibile da tastiera per un visitatore umano, ma trovabile da un
 * bot che compila tutti gli <input> del DOM. `aria-hidden` + `tabIndex={-1}`
 * lo saltano anche per chi naviga con screen reader/tastiera.
 */
function CampoTrappola({ valore, onChange }: { valore: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Lascia questo campo vuoto
        <input type="text" tabIndex={-1} autoComplete="off" value={valore} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

function formatoOraCivile(iso: string): string {
  // `iso` è un istante "pseudo-UTC" (vedi src/lib/fuso-orario.ts): i campi
  // UTC rappresentano già l'ora civile del salone, quindi si legge con
  // timeZone "UTC", mai con l'ora locale del browser del cliente (che
  // potrebbe trovarsi in un fuso diverso da quello del salone).
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export default function FlussoPrenotazione({
  slug,
  servizi,
  operatori,
  caparra,
}: {
  slug: string;
  servizi: ServizioPubblico[];
  operatori: OperatorePubblico[];
  caparra: ConfigCaparra;
}) {
  const [passo, setPasso] = useState<Passo>("servizio");
  const [servizioId, setServizioId] = useState<string>("");
  const [dataYMD, setDataYMD] = useState<string>(oggiYMD());
  const [slot, setSlot] = useState<SlotPubblico[]>([]);
  // true se il salone è chiuso nel giorno cercato (bug UX segnalato da
  // Gabriel il 14/09/2026): distingue "chiuso" da "aperto ma pieno" quando
  // `slot` è vuoto, i due casi che prima mostravano lo stesso identico
  // messaggio + modulo lista d'attesa, che per un giorno di chiusura non ha
  // senso (nessuno slot si libererà mai lì).
  const [giornoChiuso, setGiornoChiuso] = useState(false);
  const [slotScelto, setSlotScelto] = useState<SlotPubblico | null>(null);
  /**
   * NOME E COGNOME SEPARATI (19/09/2026, chiesto da Gabriel).
   *
   * Un campo solo "Nome e cognome" sembra la stessa cosa e non lo e': la
   * gente ci scrive "Giulia" e basta, e in agenda il titolare si ritrova tre
   * Giulia senza modo di distinguerle. Due campi obbligatori non sono una
   * seccatura in piu' -- sono la differenza fra una rubrica che serve e una
   * che confonde.
   *
   * Nel database resta UNA colonna `clienti.nome`, e i due campi si uniscono
   * qui: separarla vorrebbe dire una migrazione di dati e toccare ogni punto
   * che legge un nome, per un beneficio che si ottiene gia' cosi'. Se un
   * giorno servira' davvero il cognome da solo (ordinare la rubrica per
   * cognome, per esempio), allora la migrazione avra' un motivo vero.
   */
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const nomeCompleto = `${nome.trim()} ${cognome.trim()}`.trim();
  const [telefono, setTelefono] = useState("");
  // Opzionale (Fase 6, Gruppo B-bis #1): se lasciata, il cliente riceve
  // un'email di conferma -- vedi src/lib/email/notifiche.server.ts.
  const [email, setEmail] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Lista d'attesa (Fase 6): si attiva solo quando cercaSlotPubblici non trova
  // niente per il giorno scelto -- prima di questa aggiunta il cliente che non
  // passava dalla chat AI vedeva solo "prova un altro giorno" e usciva dal
  // sito senza lasciare traccia (domanda diretta di Gabriel il 13/09/2026).
  const [inCodaListaAttesa, setInCodaListaAttesa] = useState(false);
  // Anti-bot silenzioso (vedi src/lib/anti-bot.ts): `iniziatoAlleMs` è
  // l'istante di montaggio di questo componente (lazy init: calcolato una
  // sola volta), `trappola` è il campo invisibile che un cliente vero non
  // vede e non compila mai.
  const [iniziatoAlleMs] = useState(() => Date.now());
  // Consenso marketing (migrazione 0070): parte NON spuntato, per legge. La
  // conferma dell'appuntamento arriva comunque -- questa casella riguarda
  // solo promemoria di ritorno, auguri e promozioni.
  const [consensoMarketing, setConsensoMarketing] = useState(false);
  const [trappola, setTrappola] = useState("");

  const servizioScelto = useMemo(() => servizi.find((s) => s.id === servizioId) ?? null, [servizi, servizioId]);
  const nomeOperatore = (operatoreId: string) => operatori.find((o) => o.id === operatoreId)?.nome ?? "Operatore";

  // Deposito/caparra (Fase 6): stesso calcolo puro usato lato server per
  // creare la Checkout Session -- mostrato qui SOLO per informare il
  // cliente prima che scelga se procedere, il server ricalcola e decide
  // sempre da sé, non si fida di questo valore mostrato lato client.
  const importoCaparra = useMemo(
    () => (servizioScelto ? calcolaImportoCaparraCentesimi(caparra, servizioScelto.prezzoCentesimi) : 0),
    [caparra, servizioScelto]
  );
  // Caparra selettiva (migrazione 0071): con la regola "dopo_no_show" il
  // calcolo qui sopra da' 0 perche' non conosce i no-show del cliente. Si
  // chiede al server al momento della conferma, col telefono.
  const caparraSelettiva = caparra.attiva && caparra.regola === "dopo_no_show";

  async function cercaDisponibilita() {
    setErrore(null);
    setInCorso(true);
    setInCodaListaAttesa(false);
    try {
      const risultato = await cercaSlotPubblici(slug, servizioId, dataYMD);
      if (!risultato.ok) {
        setErrore(risultato.errore);
        return;
      }
      setSlot(risultato.slot);
      setGiornoChiuso(risultato.giornoChiuso);
      setPasso("slot");
    } catch {
      setErrore("Impossibile cercare la disponibilità, riprova.");
    } finally {
      setInCorso(false);
    }
  }

  /**
   * Iscrizione diretta alla lista d'attesa dal flusso di prenotazione (senza
   * passare dalla chat AI) -- stessa unica funzione di scrittura di sempre
   * (`aggiungiListaAttesaTenant`, punto 9 di CLAUDE.md) tramite
   * `iscrivitiListaAttesaPubblico`. Nessun operatore specifico richiesto qui
   * (il cliente ha scelto un giorno, non ancora un operatore -- non è mai
   * arrivato allo step "slot" per poterne scegliere uno): va bene qualunque,
   * più coerente con "voglio questo servizio quel giorno" che con l'aver già
   * un preferito.
   */
  async function iscrivitiListaAttesa() {
    if (!servizioScelto) return;
    if (!nome.trim() || !cognome.trim() || !telefono.trim()) {
      setErrore("Inserisci nome, cognome e telefono per iscriverti alla lista d'attesa.");
      return;
    }
    setErrore(null);
    setInCorso(true);
    try {
      const risultato = await iscrivitiListaAttesaPubblico(slug, {
        servizioId: servizioScelto.id,
        dataPreferitaYMD: dataYMD,
        clienteNome: nomeCompleto,
        clienteTelefono: telefono,
        clienteEmail: email.trim() || undefined,
        trappola,
        iniziatoAlleMs,
      });
      if (!risultato.ok) {
        setErrore(risultato.errore);
        return;
      }
      setInCodaListaAttesa(true);
    } catch {
      setErrore("Impossibile iscriverti alla lista d'attesa, riprova.");
    } finally {
      setInCorso(false);
    }
  }

  async function confermaPrenotazione() {
    if (!slotScelto || !servizioScelto) return;
    setErrore(null);
    setInCorso(true);
    try {
      const datiPrenotazione = {
        servizioId: servizioScelto.id,
        operatoreId: slotScelto.operatoreId,
        inizioIso: slotScelto.inizioIso,
        clienteNome: nomeCompleto,
        clienteTelefono: telefono,
        clienteEmail: email.trim() || undefined,
        consensoMarketing,
        trappola,
        iniziatoAlleMs,
      };

      let importoDaPagare = importoCaparra;
      if (caparraSelettiva) {
        const verifica = await importoCaparraPubblico(slug, { servizioId: servizioScelto.id, clienteTelefono: telefono });
        if (!verifica.ok) {
          setErrore(verifica.errore);
          return;
        }
        importoDaPagare = verifica.importoCentesimi;
      }

      // Caparra richiesta: si passa da Stripe, l'appuntamento nasce solo a
      // pagamento confermato (vedi azioni.ts) -- il redirect lascia questa
      // pagina, quindi non c'è un passo "fatto" da mostrare qui: il cliente
      // torna su questa stessa pagina dopo aver pagato (o annullato).
      if (importoDaPagare > 0) {
        const risultato = await avviaPagamentoCaparra(slug, datiPrenotazione);
        if (!risultato.ok) {
          setErrore(risultato.errore);
          return;
        }
        window.location.href = risultato.checkoutUrl;
        return;
      }

      const risultato = await prenotaPubblico(slug, datiPrenotazione);
      if (!risultato.ok) {
        setErrore(risultato.errore);
        return;
      }
      setPasso("fatto");
    } catch {
      setErrore("Impossibile completare la prenotazione, riprova.");
    } finally {
      setInCorso(false);
    }
  }

  if (servizi.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        Nessun servizio prenotabile online al momento -- contatta l&apos;attività direttamente.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      {/* indicatore di avanzamento, puramente visivo */}
      {passo !== "fatto" && (
        <ol className="mb-5 flex items-center gap-2 text-xs text-zinc-400">
          {(["servizio", "data", "slot", "contatto"] as const).map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              <span
                className={`flex size-5 items-center justify-center rounded-full ${
                  passo === p ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {i + 1}
              </span>
              {i < 3 && <span className="h-px w-4 bg-zinc-200" />}
            </li>
          ))}
        </ol>
      )}

      {passo === "servizio" && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-900">Scegli il servizio</h3>
          <div className="flex flex-col gap-2">
            {servizi.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServizioId(s.id);
                  setPasso("data");
                }}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span>
                  <span className="font-medium text-zinc-900">{s.nome}</span>
                  <span className="ml-2 text-zinc-400">{s.durataMinuti} min</span>
                </span>
                <span className="font-medium text-zinc-900">{formatoEuro(s.prezzoCentesimi)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {passo === "data" && servizioScelto && (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setPasso("servizio")} className="self-start text-xs text-zinc-400 underline">
            ← {servizioScelto.nome}
          </button>
          <h3 className="text-sm font-medium text-zinc-900">Scegli il giorno</h3>
          <input
            type="date"
            value={dataYMD}
            min={oggiYMD()}
            onChange={(e) => setDataYMD(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={inCorso}
            onClick={cercaDisponibilita}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {inCorso ? "Cerco disponibilità..." : "Cerca disponibilità"}
          </button>
        </div>
      )}

      {passo === "slot" && servizioScelto && (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setPasso("data")} className="self-start text-xs text-zinc-400 underline">
            ← Cambia giorno
          </button>
          <h3 className="text-sm font-medium text-zinc-900">
            Orari disponibili -- {new Date(`${dataYMD}T00:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          </h3>
          {slot.length === 0 ? (
            giornoChiuso ? (
              // Giorno di chiusura (nessun orario aperto quel giorno della
              // settimana, o festività per tutto il salone): nessuno slot si
              // libererà mai qui, quindi niente modulo lista d'attesa -- solo
              // l'invito a scegliere un altro giorno.
              <p className="text-sm text-zinc-600">
                Chiuso in questo giorno, scegli un altro giorno.
              </p>
            ) : inCodaListaAttesa ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Fatto -- se si libera un posto per {servizioScelto.nome} in questo giorno ti contattiamo noi.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-600">Nessuna disponibilità in questo giorno, prova un altro giorno.</p>
                <div className="relative flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <CampoTrappola valore={trappola} onChange={setTrappola} />
                  <p className="text-sm text-zinc-700">
                    Oppure iscriviti alla lista d&apos;attesa: se qualcuno cancella, ti contattiamo noi.
                  </p>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={cognome}
                    onChange={(e) => setCognome(e.target.value)}
                    placeholder="Cognome"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Telefono"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (opzionale)"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={inCorso}
                    onClick={iscrivitiListaAttesa}
                    className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {inCorso ? "Iscrivo..." : "Iscrivimi alla lista d'attesa"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slot.map((s) => (
                <button
                  key={`${s.operatoreId}-${s.inizioIso}`}
                  type="button"
                  onClick={() => {
                    setSlotScelto(s);
                    setPasso("contatto");
                  }}
                  className="flex flex-col items-center rounded-lg border border-zinc-200 px-2 py-2 text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  title={nomeOperatore(s.operatoreId)}
                >
                  <span className="font-medium text-zinc-900">{formatoOraCivile(s.inizioIso)}</span>
                  <span className="truncate text-[11px] text-zinc-400">{nomeOperatore(s.operatoreId)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {passo === "contatto" && servizioScelto && slotScelto && (
        <form
          className="relative flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            confermaPrenotazione();
          }}
        >
          <CampoTrappola valore={trappola} onChange={setTrappola} />
          <button type="button" onClick={() => setPasso("slot")} className="self-start text-xs text-zinc-400 underline">
            ← Cambia orario
          </button>
          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {servizioScelto.nome} · {formatoOraCivile(slotScelto.inizioIso)} con {nomeOperatore(slotScelto.operatoreId)}
          </div>
          {importoCaparra > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Questa attività richiede una caparra di <strong>{formatoEuro(importoCaparra)}</strong> per confermare la
              prenotazione, da pagare online nel passo successivo.
            </p>
          )}
          {caparraSelettiva && importoCaparra === 0 && (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Questa attività chiede una caparra solo a chi in passato non si è presentato a un appuntamento. Se
              riguarda te, te lo diciamo prima di confermare.
            </p>
          )}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Nome
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Es. Giulia"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Cognome
              <input
                type="text"
                required
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Es. Bianchi"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Telefono
            <input
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Es. 333 1234567"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email <span className="text-zinc-400">(facoltativa, per la conferma via email)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Es. giulia@esempio.it"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={consensoMarketing}
              onChange={(e) => setConsensoMarketing(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Acconsento a ricevere da questa attività promemoria per il prossimo appuntamento, auguri e
              offerte (facoltativo: la conferma di questa prenotazione arriva comunque; puoi revocare quando
              vuoi rispondendo al messaggio).
            </span>
          </label>
          <button
            type="submit"
            disabled={inCorso}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {inCorso
              ? importoCaparra > 0
                ? "Ti porto al pagamento..."
                : "Confermo..."
              : importoCaparra > 0
                ? `Paga la caparra (${formatoEuro(importoCaparra)}) e prenota`
                : "Conferma prenotazione"}
          </button>
        </form>
      )}

      {passo === "fatto" && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <p className="text-sm font-medium text-zinc-900">Prenotazione confermata!</p>
          <p className="text-sm text-zinc-600">Ti aspettiamo -- riceverai un messaggio di conferma dall&apos;attività se necessario.</p>
        </div>
      )}

      {errore && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errore}</p>}
    </div>
  );
}
