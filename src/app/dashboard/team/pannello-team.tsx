"use client";

import { useState, useTransition } from "react";
import {
  cambiaRuoloMembroAction,
  invitaMembroAction,
  revocaInvitoAction,
  rimuoviMembroAction,
} from "./azioni";
import type { InvitoPendente, MembroAttivita } from "@/lib/membri.server";
import Link from "next/link";

function formatoData(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function EtichettaRuolo({ ruolo }: { ruolo: "owner" | "staff" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ruolo === "owner" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {ruolo === "owner" ? "Titolare" : "Collaboratore"}
    </span>
  );
}

export function PannelloTeam({
  membri,
  inviti,
  userIdCorrente,
  haTeam,
}: {
  membri: MembroAttivita[];
  inviti: InvitoPendente[];
  userIdCorrente: string;
  haTeam: boolean;
}) {
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, startTransition] = useTransition();

  function esegui(azione: () => Promise<{ errore?: string; messaggio?: string } | undefined>) {
    setEsito(null);
    startTransition(async () => {
      const risultato = await azione();
      if (risultato?.errore) setEsito({ ok: false, testo: risultato.errore });
      else if (risultato?.messaggio) setEsito({ ok: true, testo: risultato.messaggio });
      else setEsito({ ok: true, testo: "Fatto." });
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {!haTeam ? (
        <section className="rounded-2xl border border-zinc-900 bg-zinc-50 p-5">
          <h2 className="text-base font-medium">Accessi per il personale</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Dare a un collaboratore un suo accesso alla dashboard è incluso dal piano Pro. Vede
            agenda, clienti e lista d&apos;attesa e può prenotare per chiunque, senza vedere il
            fatturato né poter cambiare servizi, prezzi o abbonamento.
          </p>
          <Link
            href="/dashboard/impostazioni"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Vedi i piani
          </Link>
        </section>
      ) : (
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-medium">Invita una persona</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Un collaboratore vede agenda, clienti e lista d&apos;attesa, e può prenotare per chiunque. Non
          vede il fatturato, non cambia servizi, prezzi e orari, e non tocca l&apos;abbonamento.
        </p>
        <form
          action={(formData) => esegui(() => invitaMembroAction(formData))}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="email_invito" className="text-xs text-zinc-500">
              Email
            </label>
            <input
              id="email_invito"
              name="email"
              type="email"
              required
              placeholder="persona@esempio.it"
              className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ruolo_invito" className="text-xs text-zinc-500">
              Ruolo
            </label>
            <select
              id="ruolo_invito"
              name="ruolo"
              defaultValue="staff"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="staff">Collaboratore</option>
              <option value="owner">Titolare</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inCorso}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Invio..." : "Invita"}
          </button>
        </form>
      </section>
      )}

      {esito && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            esito.ok
              ? "border border-green-300 bg-green-50 text-green-800"
              : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {esito.testo}
        </p>
      )}

      <section>
        <h2 className="text-sm font-medium text-zinc-500">Chi lavora qui</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {membri.map((membro) => (
            <li
              key={membro.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-900">
                  {membro.nome || membro.email || "Persona senza nome"}
                  {membro.userId === userIdCorrente && (
                    <span className="ml-2 text-xs font-normal text-zinc-400">(tu)</span>
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {membro.email} · dal {formatoData(membro.daQuando)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <EtichettaRuolo ruolo={membro.ruolo} />
                {membro.userId !== userIdCorrente && (
                  <>
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() =>
                        esegui(() =>
                          cambiaRuoloMembroAction(
                            membro.userId,
                            membro.ruolo === "owner" ? "staff" : "owner"
                          )
                        )
                      }
                      className="text-xs underline disabled:opacity-50"
                    >
                      {membro.ruolo === "owner" ? "Rendi collaboratore" : "Rendi titolare"}
                    </button>
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => esegui(() => rimuoviMembroAction(membro.userId))}
                      className="text-xs text-red-600 underline disabled:opacity-50"
                    >
                      Rimuovi
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {inviti.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500">Inviti in attesa</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {inviti.map((invito) => (
              <li
                key={invito.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 p-4"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-800">{invito.email}</span>
                  <span className="text-xs text-zinc-500">
                    Scade il {formatoData(invito.scadeIl)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <EtichettaRuolo ruolo={invito.ruolo} />
                  <button
                    type="button"
                    disabled={inCorso}
                    onClick={() => esegui(() => revocaInvitoAction(invito.id))}
                    className="text-xs text-red-600 underline disabled:opacity-50"
                  >
                    Revoca
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
