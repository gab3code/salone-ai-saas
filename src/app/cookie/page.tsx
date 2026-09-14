import type { Metadata } from "next";
import { PaginaLegale, H2, P } from "@/components/legale/PaginaLegale";

export const metadata: Metadata = { title: "Cookie Policy -- Salone AI" };

/**
 * Verificato nel codice (14/09/2026) prima di scrivere questa pagina, non
 * per template: nessuno script di analytics/tracking/marketing in tutto
 * `src/` (Google Analytics, Vercel Analytics, PostHog, pixel Meta -- nessuno
 * presente). Solo il cookie di sessione tecnico di Supabase Auth. Per
 * questo NON serve un banner di consenso: sotto il GDPR/ePrivacy i cookie
 * strettamente necessari al funzionamento del servizio non richiedono
 * consenso preventivo, solo un'informativa chiara come questa. Se in futuro
 * si aggiungerà uno strumento di analytics o marketing, questa pagina e il
 * comportamento del sito (banner di consenso incluso) andranno aggiornati
 * PRIMA di attivarlo, non dopo.
 */
export default function PaginaCookie() {
  return (
    <PaginaLegale titolo="Cookie Policy" aggiornata="14 settembre 2026">
      <P>
        Questa pagina spiega quali cookie usa Salone AI e perché. Aggiorneremo questa pagina prima di introdurre
        eventuali nuovi cookie, non dopo.
      </P>

      <H2>Cookie tecnici necessari</H2>
      <P>
        Usiamo un solo tipo di cookie: quello di sessione creato da Supabase, il fornitore che gestisce
        l&apos;accesso al tuo account. Serve esclusivamente a mantenerti autenticato mentre usi la dashboard e
        scade alla disconnessione o dopo un periodo di inattività. Senza questo cookie non potresti restare
        collegato al tuo account.
      </P>

      <H2>Nessun cookie di profilazione o marketing</H2>
      <P>
        Oggi Salone AI non usa nessuno strumento di analisi del traffico, pubblicità o profilazione (nessun Google
        Analytics, nessun pixel di tracciamento, nessun cookie di terze parti per marketing). Per questo non
        mostriamo un banner di richiesta consenso: i cookie strettamente necessari al funzionamento del servizio
        non lo richiedono per legge.
      </P>

      <H2>Come gestire i cookie</H2>
      <P>
        Puoi cancellare o bloccare i cookie dalle impostazioni del tuo browser in qualunque momento -- tieni
        presente che bloccando il cookie di sessione di Supabase non potrai restare autenticato nella dashboard.
      </P>

      <H2>Altre pagine collegate</H2>
      <P>
        Per come trattiamo i tuoi dati personali in generale, vedi la nostra{" "}
        <a href="/privacy" className="underline decoration-white/40 hover:text-white">
          Informativa Privacy
        </a>
        .
      </P>
    </PaginaLegale>
  );
}
