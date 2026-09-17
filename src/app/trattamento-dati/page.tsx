import type { Metadata } from "next";
import { PaginaLegale, H2, P, Ul } from "@/components/legale/PaginaLegale";

export const metadata: Metadata = { title: "Accordo sul trattamento dei dati -- Salone AI" };

/**
 * Accordo sul trattamento dei dati (art. 28 GDPR), scritto il 16/09/2026.
 *
 * NON è una consulenza legale, e più delle altre pagine legali va fatta
 * leggere a un professionista prima di firmarla con un cliente vero: qui non
 * si descrive soltanto cosa fa il prodotto, ci si assume degli obblighi.
 *
 * Perché esiste: l'art. 28 richiede un accordo SCRITTO fra titolare (il
 * salone) e responsabile (Salone AI) ogni volta che il secondo tratta dati
 * personali per conto del primo. Fino a oggi non ce n'era nessuno, mentre
 * ogni attività registrata consegnava a Salone AI nomi, telefoni, email e
 * storico appuntamenti dei propri clienti. Era una mancanza di entrambe le
 * parti, ed è anche la prima cosa che chiede un cliente strutturato.
 *
 * Il contenuto è scritto sul comportamento REALE del codice (misure di
 * sicurezza, elenco dei sub-responsabili, cancellazione, luogo di
 * conservazione), non copiato da un modello generico: ogni riga qui dentro
 * deve restare vera, e se un domani cambia il codice va cambiata anche
 * questa pagina.
 */
export default function PaginaTrattamentoDati() {
  return (
    <PaginaLegale titolo="Accordo sul trattamento dei dati" aggiornata="17 settembre 2026">
      <P>
        Questo accordo regola il trattamento dei dati personali che Salone AI svolge{" "}
        <strong className="text-white">per conto</strong> dell&apos;attività che usa il servizio, come previsto
        dall&apos;art. 28 del Regolamento (UE) 2016/679 (&quot;GDPR&quot;). Si applica automaticamente a chiunque
        usi Salone AI e integra i <a href="/termini" className="underline decoration-white/40 hover:text-white">Termini di servizio</a>{" "}
        e l&apos;<a href="/privacy" className="underline decoration-white/40 hover:text-white">Informativa privacy</a>.
      </P>

      <H2>Chi è chi</H2>
      <P>
        L&apos;<strong className="text-white">attività</strong> che usa Salone AI (il salone, il centro estetico,
        il professionista) è il <strong className="text-white">Titolare del trattamento</strong> dei dati dei
        propri clienti: decide lei quali dati raccogliere e perché.
      </P>
      <P>
        <strong className="text-white">[NOME_TITOLARE]</strong>, che gestisce Salone AI, è il{" "}
        <strong className="text-white">Responsabile del trattamento</strong>: tratta quei dati solo per fornire il
        servizio, secondo le istruzioni dell&apos;attività, e non li usa mai per finalità proprie.
      </P>

      <H2>Cosa trattiamo, e perché</H2>
      <Ul>
        <li>
          <strong className="text-white">Oggetto e finalità</strong>: fornire una piattaforma di prenotazione,
          gestione appuntamenti, rubrica clienti, comunicazioni automatiche (email e SMS) e assistente
          conversazionale.
        </li>
        <li>
          <strong className="text-white">Durata</strong>: per tutto il tempo in cui l&apos;attività usa Salone AI.
        </li>
        <li>
          <strong className="text-white">Categorie di interessati</strong>: i clienti finali dell&apos;attività, e
          le persone che l&apos;attività autorizza ad accedere alla propria dashboard.
        </li>
        <li>
          <strong className="text-white">Tipi di dati</strong>: nome, numero di telefono, email, data di
          nascita se l&apos;attività la raccoglie, storico degli appuntamenti e dei servizi, note e tag inseriti
          dall&apos;attività, contenuto delle conversazioni con l&apos;assistente, eventuali recensioni lasciate,
          e la <strong className="text-white">segnalazione di mancata presentazione</strong> a un appuntamento
          (il &quot;no-show&quot;), che l&apos;attività può registrare a posteriori. Quest&apos;ultima è un
          giudizio sul comportamento di una persona, non un dato di fatto neutro: la registra l&apos;attività,
          sotto la propria responsabilità, ed è visibile solo a lei. Salone AI non la usa per nessuna decisione
          automatica -- non blocca prenotazioni, non cambia prezzi, non segnala niente a nessun&apos;altra
          attività.
        </li>
      </Ul>
      <P>
        Salone AI <strong className="text-white">non chiede e non prevede</strong> il trattamento di categorie
        particolari di dati (art. 9 GDPR), come dati sulla salute. Se un&apos;attività ne inserisce ugualmente --
        per esempio scrivendo un&apos;allergia nelle note di un cliente -- lo fa sotto la propria responsabilità e
        deve avere una base giuridica propria per farlo.
      </P>

      <H2>I nostri obblighi</H2>
      <Ul>
        <li>
          Trattiamo i dati <strong className="text-white">solo su istruzione dell&apos;attività</strong>: le
          istruzioni sono l&apos;uso normale delle funzioni del prodotto. Non usiamo i dati dei clienti finali per
          scopi nostri, non li vendiamo, non li cediamo per marketing.
        </li>
        <li>
          Chi in Salone AI ha accesso tecnico ai dati è vincolato alla{" "}
          <strong className="text-white">riservatezza</strong>.
        </li>
        <li>
          Assistiamo l&apos;attività quando un suo cliente esercita i propri diritti (accesso, rettifica,
          cancellazione, portabilità), e quando deve rispondere a una violazione o valutare un rischio. Per i tre
          casi più frequenti non serve nemmeno scriverci: la scheda cliente è modificabile, la rubrica è
          esportabile in CSV e il titolare può cancellare definitivamente una singola scheda dalla scheda stessa.
        </li>
        <li>
          <strong className="text-white">Ti avvisiamo senza ingiustificato ritardo</strong>, e comunque entro 48
          ore da quando ne veniamo a conoscenza, se subiamo una violazione dei dati che riguarda la tua attività,
          con quello che sappiamo su cosa è successo e cosa stiamo facendo.
        </li>
        <li>
          Su richiesta mettiamo a disposizione le informazioni necessarie a dimostrare il rispetto di questi
          obblighi.
        </li>
      </Ul>

      <H2>Come proteggiamo i dati</H2>
      <Ul>
        <li>
          <strong className="text-white">Separazione fra attività applicata dal database</strong>, non solo dal
          codice: ogni riga porta con sé l&apos;attività a cui appartiene, e il database rifiuta da sé la lettura
          dei dati di un&apos;altra attività. È la protezione su cui contiamo di più, perché continua a valere
          anche se sbagliamo a scrivere una query.
        </li>
        <li>Dati cifrati in transito (HTTPS) e a riposo, e password mai conservate in chiaro.</li>
        <li>
          <strong className="text-white">Ruoli e permessi</strong>: l&apos;attività decide chi tra i suoi
          collaboratori può vedere cosa, e un collaboratore non accede a fatturato, configurazione, fatturazione
          né all&apos;esportazione della rubrica.
        </li>
        <li>
          Nessuno in Salone AI può entrare nella dashboard di un&apos;attività fingendosi il titolare: la funzione
          non esiste nel prodotto, per scelta.
        </li>
        <li>
          Il pannello interno di amministrazione mostra solo <strong className="text-white">numeri aggregati</strong>{" "}
          (quanti clienti, quanti appuntamenti), mai i dati dei singoli clienti finali e mai il contenuto delle
          conversazioni con l&apos;assistente. Ogni intervento manuale viene registrato.
        </li>
      </Ul>
      <P>
        <strong className="text-white">Limite dichiarato onestamente</strong>: le credenziali del calendario
        esterno che un&apos;attività collega volontariamente (oggi solo Google, via OAuth) sono conservate senza
        cifratura aggiuntiva a livello applicativo, oltre a quella del database. È un miglioramento già previsto
        e non ancora fatto: preferiamo scriverlo qui piuttosto che lasciartelo scoprire.
      </P>

      <H2>Altri fornitori (sub-responsabili)</H2>
      <P>
        Per fornire il servizio ci appoggiamo ad altri fornitori, autorizzati fin d&apos;ora. L&apos;elenco
        completo e sempre aggiornato è nella{" "}
        <a href="/privacy" className="underline decoration-white/40 hover:text-white">
          sezione dedicata dell&apos;informativa privacy
        </a>
        . Se ne aggiungiamo o sostituiamo uno te lo comunichiamo prima che inizi a trattare dati, e hai il diritto
        di opporti: se l&apos;opposizione rende impossibile fornirti il servizio, puoi recedere senza penali.
      </P>
      <P>
        Ognuno di questi fornitori è vincolato a obblighi di protezione dei dati equivalenti a quelli di questo
        accordo, e restiamo noi responsabili verso di te del loro operato.
      </P>

      <H2>Dove stanno i dati</H2>
      <P>
        Il database, dove vivono i dati dei tuoi clienti, è nell&apos;Unione Europea (Irlanda). Alcuni fornitori
        sono società statunitensi -- in particolare il fornitore del modello AI, quello dell&apos;hosting e quello
        dei pagamenti -- e per quei trasferimenti ci appoggiamo alle clausole contrattuali standard approvate
        dalla Commissione Europea (art. 46 GDPR).
      </P>

      <H2>Alla fine del rapporto</H2>
      <P>
        Quando chiudi il tuo account, o su tua richiesta, cancelliamo i dati trattati per tuo conto entro 30
        giorni: i dati dei tuoi clienti, gli appuntamenti, le recensioni, le foto caricate e la tua pagina
        pubblica. La cancellazione è definitiva e non recuperabile. Puoi esportare la tua rubrica clienti in
        qualunque momento prima, direttamente dalla dashboard.
      </P>
      <P>
        Due cose sopravvivono, ed entrambe riguardano te come nostro cliente, non i tuoi clienti: i dati e i
        documenti fiscali del tuo abbonamento, che la legge italiana ci obbliga a conservare per 10 anni, e il
        registro dei nostri interventi tecnici (data, tipo di intervento, nome e indirizzo web dell&apos;attività,
        qualche numero riassuntivo), che teniamo per poter dimostrare cosa è stato fatto e da chi. Il dettaglio
        di entrambi è nell&apos;{" "}
        <a href="/privacy" className="underline decoration-white/40 hover:text-white">
          informativa privacy
        </a>
        .
      </P>

      <H2>Contatti</H2>
      <P>
        Per qualunque questione relativa a questo accordo:{" "}
        <a
          href="mailto:gabrielmazzucchelli3@gmail.com"
          className="underline decoration-white/40 hover:text-white"
        >
          gabrielmazzucchelli3@gmail.com
        </a>
        .
      </P>
    </PaginaLegale>
  );
}
