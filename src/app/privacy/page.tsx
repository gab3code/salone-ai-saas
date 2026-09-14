import type { Metadata } from "next";
import { PaginaLegale, H2, P, Ul } from "@/components/legale/PaginaLegale";

export const metadata: Metadata = { title: "Informativa Privacy -- Salone AI" };

/**
 * NON è una consulenza legale: è un punto di partenza onesto, scritto sulla
 * base di come il codice tratta davvero i dati oggi (letto src/lib/supabase,
 * booking-engine.server.ts, stripe/, email/mailjet.server.ts, calendario
 * Google -- non testo generico copiato da un template). Il placeholder
 * `[NOME_TITOLARE]` va completato da Gabriel quando avrà un'identità legale
 * definita (oggi opera come persona fisica, senza Partita IVA -- vedi
 * PIANO.md Gruppo A). Consigliato un controllo di un professionista (avvocato
 * o commercialista con competenze privacy) prima di aprire i pagamenti veri
 * a clienti reali, non solo per fiducia ma perché il trattamento dei dati
 * dei CLIENTI FINALI dei saloni (non solo dei titolari che pagano
 * l'abbonamento) ha implicazioni GDPR reali.
 */
export default function PaginaPrivacy() {
  return (
    <PaginaLegale titolo="Informativa Privacy" aggiornata="14 settembre 2026">
      <P>
        Questa informativa spiega quali dati personali raccoglie Salone AI, perché, per quanto tempo li conserva e
        quali diritti hai su di essi, in conformità al Regolamento (UE) 2016/679 (&quot;GDPR&quot;) e al Codice
        Privacy italiano.
      </P>

      <H2>Titolare del trattamento</H2>
      <P>
        [NOME_TITOLARE], contattabile all&apos;indirizzo email{" "}
        <a href="mailto:gabrielmazzucchelli3@gmail.com" className="underline decoration-white/40 hover:text-white">
          gabrielmazzucchelli3@gmail.com
        </a>
        .
      </P>

      <H2>Due ruoli diversi, a seconda di chi sei</H2>
      <P>
        Se sei il <strong className="text-white">titolare di un&apos;attività</strong> che usa Salone AI per gestire
        le proprie prenotazioni, per i tuoi dati di account (email, nome, dati di fatturazione, utilizzo del
        servizio) <strong className="text-white">Salone AI è il Titolare del trattamento</strong> ed è a questa
        informativa che fai riferimento.
      </P>
      <P>
        Se sei un <strong className="text-white">cliente finale</strong> che prenota su una pagina pubblica gestita
        da un&apos;attività (es. <span className="italic">nomesalone.saloneai.it/s/nome-attivita</span>), i tuoi
        dati (nome, telefono, email, storico appuntamenti) sono raccolti dall&apos;attività che li usa per
        gestire la tua prenotazione: quell&apos;attività è il Titolare del trattamento dei tuoi dati, e Salone AI
        agisce come Responsabile del trattamento per suo conto (fornisce solo l&apos;infrastruttura tecnica). Per
        richieste sui tuoi dati come cliente finale, contatta prima l&apos;attività presso cui hai prenotato; se
        non ottieni risposta, puoi comunque scriverci all&apos;indirizzo sopra.
      </P>

      <H2>Quali dati raccogliamo e perché</H2>
      <Ul>
        <li>
          <strong className="text-white">Dati di account</strong> (email, password cifrata, nome dell&apos;attività,
          fuso orario): per creare e gestire il tuo accesso alla piattaforma.
        </li>
        <li>
          <strong className="text-white">Dati di fatturazione e abbonamento</strong> (piano scelto, stato del
          pagamento): gestiti da Stripe, nostro fornitore di pagamenti -- Salone AI non memorizza mai i dati
          della tua carta.
        </li>
        <li>
          <strong className="text-white">Dati inseriti nel tuo CRM</strong> (clienti, appuntamenti, servizi,
          operatori): inseriti da te o dai tuoi clienti tramite la pagina pubblica o l&apos;assistente AI, salvati
          per farti gestire la tua attività.
        </li>
        <li>
          <strong className="text-white">Dati di calendario</strong> (solo se colleghi Google Calendar): usati
          esclusivamente per sincronizzare i tuoi impegni personali con la disponibilità mostrata ai clienti.
        </li>
        <li>
          <strong className="text-white">Dati tecnici minimi</strong> (log applicativi, indirizzo IP nelle
          richieste): usati solo per sicurezza e diagnosi di problemi, non per profilazione.
        </li>
      </Ul>

      <H2>Base giuridica</H2>
      <P>
        Trattiamo i tuoi dati per eseguire il contratto di fornitura del servizio (art. 6.1.b GDPR), per adempiere
        obblighi di legge come quelli fiscali (art. 6.1.c), e per il nostro legittimo interesse a mantenere la
        piattaforma sicura e funzionante (art. 6.1.f).
      </P>

      <H2>Chi riceve i tuoi dati (fornitori terzi)</H2>
      <P>Ci appoggiamo ad alcuni fornitori specializzati, ognuno con il proprio ruolo:</P>
      <Ul>
        <li>
          <strong className="text-white">Supabase</strong> (database e autenticazione), infrastruttura nella
          regione UE (Irlanda, eu-west-1).
        </li>
        <li>
          <strong className="text-white">Stripe</strong> (pagamenti), che può trattare dati anche fuori dall&apos;UE
          sulla base di clausole contrattuali standard approvate dalla Commissione Europea.
        </li>
        <li>
          <strong className="text-white">Mailjet</strong> (invio email transazionali di conferma/notifica).
        </li>
        <li>
          <strong className="text-white">Google</strong> (solo se colleghi volontariamente il tuo Google Calendar).
        </li>
        <li>
          <strong className="text-white">Meta/WhatsApp Business</strong> (solo per le attività che attivano
          l&apos;assistente su WhatsApp, funzione non ancora disponibile a tutti).
        </li>
      </Ul>
      <P>Nessuno di questi fornitori è autorizzato a usare i tuoi dati per scopi propri.</P>

      <H2>Per quanto tempo conserviamo i dati</H2>
      <P>
        Per tutta la durata del tuo account, più il tempo necessario ad adempiere obblighi di legge (es. fiscali)
        dopo la sua chiusura. Se cancelli l&apos;account, i dati vengono cancellati o anonimizzati entro un tempo
        ragionevole, salvo quanto la legge richiede di conservare più a lungo.
      </P>

      <H2>I tuoi diritti</H2>
      <P>
        Puoi chiedere in qualunque momento di accedere ai tuoi dati, correggerli, cancellarli, limitarne l&apos;uso,
        riceverli in un formato portabile o opporti al trattamento, scrivendo all&apos;indirizzo email sopra. Puoi
        anche proporre reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).
      </P>

      <H2>Cookie</H2>
      <P>
        Per il dettaglio sui cookie usati dal sito, vedi la nostra{" "}
        <a href="/cookie" className="underline decoration-white/40 hover:text-white">
          Cookie Policy
        </a>
        .
      </P>

      <H2>Modifiche a questa informativa</H2>
      <P>
        Se cambieremo in modo sostanziale come trattiamo i tuoi dati, aggiorneremo questa pagina e, se il
        cambiamento ti riguarda direttamente, te lo comunicheremo via email.
      </P>
    </PaginaLegale>
  );
}
