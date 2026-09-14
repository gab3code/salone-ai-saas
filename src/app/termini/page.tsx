import type { Metadata } from "next";
import { PaginaLegale, H2, P, Ul } from "@/components/legale/PaginaLegale";

export const metadata: Metadata = { title: "Termini di Servizio -- Salone AI" };

/**
 * Stessa nota onesta di privacy/page.tsx: non è consulenza legale, è un
 * punto di partenza scritto sul comportamento reale del prodotto (piani in
 * src/lib/piani.ts, trial e billing in stripe/, assistente AI in
 * src/lib/ai/). Da far rivedere da un professionista prima dei pagamenti
 * veri, stesso motivo di privacy/page.tsx.
 */
export default function PaginaTermini() {
  return (
    <PaginaLegale titolo="Termini di Servizio" aggiornata="14 settembre 2026">
      <P>
        Questi termini regolano l&apos;uso di Salone AI, un servizio SaaS per la gestione di prenotazioni e clienti
        rivolto a professionisti che lavorano su appuntamento. Registrando un account accetti questi termini.
      </P>

      <H2>Il servizio</H2>
      <P>
        Salone AI offre una pagina di prenotazione pubblica, un calendario, un CRM clienti e un assistente basato
        su intelligenza artificiale che risponde ai clienti finali. Le risposte dell&apos;assistente AI sono
        generate automaticamente: possono contenere errori, e resta tua responsabilità supervisionare il servizio
        offerto ai tuoi clienti.
      </P>

      <H2>Account e registrazione</H2>
      <P>
        Devi fornire informazioni vere e aggiornate sulla tua attività. L&apos;account è personale: sei
        responsabile di mantenere riservate le tue credenziali di accesso e di ogni attività svolta con il tuo
        account.
      </P>

      <H2>Piani, prezzi e fatturazione</H2>
      <Ul>
        <li>Il piano Free è gratuito, senza scadenza, con i limiti indicati nella pagina dei prezzi.</li>
        <li>
          I piani a pagamento si rinnovano automaticamente al ciclo scelto finché non li disdici; l&apos;addebito
          avviene tramite Stripe, non gestiamo mai direttamente i dati della tua carta.
        </li>
        <li>
          Il periodo di prova (dove previsto) richiede una carta valida ma non la addebita prima della sua fine:
          se non disdici prima, l&apos;addebito parte automaticamente al piano scelto.
        </li>
        <li>Puoi cambiare piano o disdire in qualunque momento dal pannello di gestione abbonamento.</li>
      </Ul>

      <H2>Uso consentito</H2>
      <P>
        Non puoi usare Salone AI per attività illecite, per inviare comunicazioni non richieste ai tuoi clienti,
        per tentare di aggirare i limiti tecnici della piattaforma o per caricare contenuti offensivi, ingannevoli
        o lesivi di diritti altrui.
      </P>

      <H2>I tuoi dati restano tuoi</H2>
      <P>
        I dati che inserisci (clienti, appuntamenti, servizi) restano di tua proprietà. Puoi esportarli in
        qualunque momento (es. l&apos;export CSV clienti dalla dashboard) e richiederne la cancellazione chiudendo
        l&apos;account.
      </P>

      <H2>Limitazione di responsabilità</H2>
      <P>
        Il servizio è fornito &quot;così com&apos;è&quot;. Facciamo il possibile per mantenerlo disponibile e
        affidabile, ma non garantiamo un funzionamento ininterrotto o privo di errori, e non rispondiamo di danni
        indiretti derivanti dall&apos;uso del servizio, nei limiti massimi consentiti dalla legge.
      </P>

      <H2>Sospensione e chiusura dell&apos;account</H2>
      <P>
        Possiamo sospendere o chiudere un account che violi questi termini, con preavviso quando ragionevolmente
        possibile. Puoi chiudere il tuo account in qualunque momento.
      </P>

      <H2>Modifiche a questi termini</H2>
      <P>
        Possiamo aggiornare questi termini nel tempo. In caso di modifiche sostanziali te lo comunicheremo via
        email con un preavviso ragionevole prima che entrino in vigore.
      </P>

      <H2>Legge applicabile</H2>
      <P>Questi termini sono regolati dalla legge italiana.</P>

      <H2>Contatti</H2>
      <P>
        Per qualunque domanda su questi termini, scrivici a{" "}
        <a href="mailto:gabrielmazzucchelli3@gmail.com" className="underline decoration-white/40 hover:text-white">
          gabrielmazzucchelli3@gmail.com
        </a>
        .
      </P>
    </PaginaLegale>
  );
}
