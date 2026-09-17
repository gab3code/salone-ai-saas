"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Dopo la registrazione da un piano a pagamento (Prezzi.tsx ->
 * /registrati?piano=growth), l'utente atterra qui con lo stesso parametro in
 * due casi possibili: conferma email disattivata (redirect immediato dopo
 * signUp) o attiva (Supabase riporta qui via `emailRedirectTo` dopo che ha
 * cliccato il link ricevuto via email). In entrambi i casi il checkout va
 * aperto una volta sola, appena c'è una sessione valida -- da un componente
 * CLIENT, mai dal server component della dashboard (serve
 * `window.location` per il redirect verso Stripe, un server component non
 * può farlo).
 */
export function AvviaCheckoutSeNecessario({ pianoAttuale }: { pianoAttuale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const avviato = useRef(false);

  useEffect(() => {
    const piano = searchParams.get("piano");
    if (!piano || avviato.current) return;

    // Già su quel piano (es. l'utente ha ricaricato la pagina dopo un
    // checkout già completato): non riaprire Stripe, pulisce solo l'URL.
    if (piano === pianoAttuale) {
      router.replace("/dashboard");
      return;
    }
    avviato.current = true;

    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piano }),
    })
      .then(async (risposta) => {
        const dati = await risposta.json();
        // Mancano i dati per la fattura: non è un errore, è un passaggio in
        // più. Si porta l'utente al modulo portandosi dietro il piano, così
        // dopo averlo compilato il checkout riparte da solo invece di
        // lasciarlo su una pagina salvata senza sapere cosa fare.
        if (risposta.status === 409 && typeof dati.vaiA === "string") {
          router.replace(dati.vaiA);
          return;
        }
        if (!risposta.ok || !dati.url) {
          throw new Error(dati.errore ?? "Errore durante l'avvio del pagamento.");
        }
        window.location.href = dati.url;
      })
      .catch(() => {
        // Se il checkout non parte (piano non valido, Stripe non ancora
        // configurato in questo ambiente...) l'utente resta comunque con un
        // account Free funzionante -- non lo si blocca fuori dalla
        // dashboard per un problema di pagamento.
        router.replace("/dashboard");
      });
  }, [searchParams, pianoAttuale, router]);

  return null;
}
