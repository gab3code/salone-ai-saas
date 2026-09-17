import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import {
  PREZZO_BASE_CENTESIMI,
  PREZZO_OPERATORE_EXTRA_CENTESIMI,
  limiteMensilePrenotazioni,
  limiteOperatori,
} from "@/lib/piani";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";
import { GlowBorder } from "./GlowBorder";
import { LiquidMetal } from "./LiquidMetal";

/**
 * Struttura piani reale, decisa con Gabriel e documentata in DECISIONS.md
 * (voce "Struttura piani Free -> Enterprise") -- NON numeri inventati per la
 * landing. L'AI è inclusa da Growth in su (non solo Pro): il costo reale per
 * conversazione è basso, vedi DECISIONS.md per il ragionamento completo.
 *
 * Aggiornamento 12/09/2026 -- rimossi i badge "in arrivo" che c'erano su
 * Analytics/Promemoria/WhatsApp/SMS/tono AI/Instagram-Telegram/PWA: scelta
 * esplicita di Gabriel, discussa a fondo (vedi DECISIONS.md "Il sito
 * descrive il prodotto al lancio, non lo stato di oggi"). Il commitment è
 * costruire davvero tutta questa lista, WhatsApp incluso nonostante dipenda
 * dall'approvazione business di Meta, prima di aprire i pagamenti veri --
 * non è più onesto marcarle "in arrivo" su una pagina che descrive un
 * prodotto finito, ma resta un impegno concreto da rispettare, non
 * un'etichetta da poter dimenticare.
 *
 * Aggiornamento 12/09/2026 (seconda revisione) -- due correzioni, vedi
 * DECISIONS.md per il dettaglio:
 * 1) "Instagram e Telegram" tolto dalla voce Enterprise (richiesta di
 *    Gabriel: restano un obiettivo multi-canale futuro, ma promuoverli già
 *    oggi "è inutile" -- sostituito con una voce Enterprise vera, coerente
 *    col target "catene e gruppi" (multi-sede).
 * 2) la prova gratuita di 10 giorni resta SOLO su Growth, non più su Pro
 *    (richiesta di Gabriel: "metti la prova gratuita solo sul piano
 *    growth") -- coerente con `giorniDiProva` in src/lib/stripe/piani.ts,
 *    aggiornato allo stesso modo.
 *
 * Aggiornamento 14/09/2026 (Fase 5+SMS) -- il prezzo di Pro non è più fisso:
 * il prezzo base include 1 operatore, ognuno oltre il primo costa 20€/mese in
 * più (deciso con Gabriel dopo aver introdotto l'SMS come canale di
 * fallback -- il costo Skebby reale scala con quanti appuntamenti/promemoria
 * un salone genera, che scala a sua volta con gli operatori, vedi
 * DECISIONS.md e priceIdOperatoreExtra in stripe/piani.ts). `notaPrezzo`
 * sotto rende esplicita questa condizione, altrimenti "€xx,90/mese" letto da
 * solo sarebbe una promessa scritta diversa da quella che il checkout
 * applica davvero (stesso principio del controllo promesse del sito del
 * 13/09/2026 che ha portato a `limiteOperatori`/`pianoHaAnalytics`/ecc.).
 *
 * Aggiornamento 14/09/2026 (rielaborazione prezzi/margini) -- prezzo base di
 * Pro portato da €69,90 a €89,90/mese (pareggia il prezzo del piano
 * equivalente di Estetia, vedi DECISIONS.md "Struttura piani e prezzi":
 * scelto sopra due alternative più morbide perché il margine worst-case a
 * 69,90€ era sceso a ~5% dopo aver messo a fuoco il costo reale della quota
 * AI+SMS piena). Prezzo Stripe aggiornato (nuovo Price, il vecchio 69,90€
 * archiviato -- Stripe non permette di modificare l'importo di un Price
 * esistente). In cambio del prezzo più alto, Gabriel ha esplicitamente
 * chiesto "vantaggi seri": tre voci aggiunte alla lista di Pro
 * (Automazioni extra, Supporto prioritario, Report/analytics avanzati),
 * scelte da Gabriel tra le opzioni proposte -- **impegno di prodotto ancora
 * da costruire in codice** (nessuna delle tre esiste oggi), stesso principio
 * già seguito per WhatsApp/SMS/tono AI quando erano ancora da costruire
 * (commento più sopra: "il sito descrive il prodotto al lancio, non lo
 * stato di oggi" -- corretto qui perché nessun pagamento reale è ancora
 * live, vedi PIANO.md per il checklist di cosa manca prima di aprirli).
 */
/**
 * Aggiornamento 17/09/2026 -- il listino pubblico non è più scritto a mano.
 *
 * Trovato nel controllo notturno chiesto da Gabriel: questa pagina aveva
 * "€19,90"/"€39,90"/"€89,90" e "+10€"/"+15€"/"+20€" come stringhe letterali,
 * mentre `src/lib/piani.ts` teneva gli stessi numeri come fonte unica per il
 * pannello admin e per /dashboard/abbonamento. Il commento sopra
 * `PREZZO_BASE_CENTESIMI` avvertiva esattamente di questo rischio ("due copie
 * dello stesso listino divergono sempre, e divergono in silenzio") -- e la
 * copia scollegata era proprio la prima che il cliente legge prima di pagare.
 * Ora la landing legge gli stessi centesimi del checkout.
 *
 * Il formato resta quello della landing ("€19,90", simbolo davanti) e non
 * `formatoEuroDaCentesimi` ("19,90 €", formato it-IT standard usato in
 * dashboard): è una scelta tipografica della pagina marketing, non un secondo
 * listino -- il NUMERO arriva comunque da `piani.ts`.
 */
function euroLandingDaCentesimi(centesimi: number): string {
  const intero = Math.floor(centesimi / 100);
  const decimali = centesimi % 100;
  return decimali === 0 ? `€${intero}` : `€${intero},${String(decimali).padStart(2, "0")}`;
}

function notaOperatoreExtra(piano: "starter" | "growth" | "pro"): string {
  return `1 operatore incluso, +${euroLandingDaCentesimi(PREZZO_OPERATORE_EXTRA_CENTESIMI[piano])}/mese ciascuno in più`;
}

const PIANI = [
  {
    nome: "Free",
    prezzo: euroLandingDaCentesimi(PREZZO_BASE_CENTESIMI.free),
    periodo: "/mese",
    descrizione: "Per iniziare senza rischi.",
    // "CRM di base" (17/09/2026): era una differenza inventata. Nel codice non
    // esiste nessun gate di piano sulla scheda cliente, sui tag, sulle note,
    // sullo storico o sull'export -- un tenant Free ha esattamente lo stesso
    // CRM di uno Starter. La riga ora dice cosa distingue davvero il Free:
    // il tetto di prenotazioni e l'operatore singolo.
    voci: [
      `${limiteOperatori("free")} operatore`,
      "Calendario e pagina pubblica",
      "Scheda cliente con storico",
      `Fino a ${limiteMensilePrenotazioni("free")} prenotazioni/mese`,
    ],
    consigliato: false,
  },
  {
    nome: "Starter",
    prezzo: euroLandingDaCentesimi(PREZZO_BASE_CENTESIMI.starter),
    periodo: "/mese",
    // Aggiornamento 16/09/2026: la descrizione era "Quando il salone cresce",
    // che però descrive Growth -- crescere è esattamente il momento in cui
    // serve l'assistente. E nessuna delle tre voci di prima ("prenotazioni
    // illimitate, operatori illimitati, CRM completo") era un motivo per
    // pagare 19,90€ invece di usare Fresha gratis, che quelle cose le dà.
    // Il motivo vero -- zero commissioni, nessun marketplace, i clienti
    // restano del salone e non devono scaricare nessuna app -- non era
    // scritto nella scheda ma solo sparso nel resto della pagina.
    descrizione: "Il gestionale, senza l'AI.",
    voci: [
      "Zero commissioni sulle prenotazioni",
      "I tuoi clienti restano tuoi, nessuna app da far scaricare",
      "Prenotazioni illimitate",
      "Operatori illimitati",
      "Nessun tetto di prenotazioni mensili",
      "Accessi per il personale, con permessi",
    ],
    consigliato: false,
    notaPrezzo: notaOperatoreExtra("starter"),
  },
  {
    nome: "Growth",
    prezzo: euroLandingDaCentesimi(PREZZO_BASE_CENTESIMI.growth),
    periodo: "/mese",
    descrizione: "Con l'assistente AI.",
    voci: ["Tutto di Starter", "Assistente AI via chat web", "Analytics", "Promemoria automatici"],
    consigliato: true,
    notaPrezzo: notaOperatoreExtra("growth"),
    // 10 giorni di prova prima del primo addebito (decisione con Gabriel
    // dell'11/09/2026, vedi giorniDiProva in src/lib/stripe/piani.ts).
    // Ristretto al solo Growth il 12/09/2026 (richiesta di Gabriel: "metti
    // la prova gratuita solo sul piano growth") -- prima copriva anche Pro,
    // ora è l'unico piano con trial: quello con cui la maggior parte dei
    // saloni entra nel prodotto, non un incentivo sparso su più piani.
    trial: true,
  },
  {
    nome: "Pro",
    prezzo: euroLandingDaCentesimi(PREZZO_BASE_CENTESIMI.pro),
    periodo: "/mese",
    descrizione: "Anche su WhatsApp.",
    voci: [
      "Tutto di Growth",
      "Assistente AI su WhatsApp",
      // 17/09/2026: "SMS" da solo lasciava immaginare un canale in più sempre
      // attivo. Nel codice (`piani.ts` + `sms/invio.server.ts`) l'SMS parte
      // SOLO quando il cliente non ha lasciato un'email, mai in aggiunta, e
      // ha un tetto mensile per operatore. Scriverlo qui costa una riga e
      // toglie una contestazione dopo il pagamento.
      "SMS di promemoria per i clienti senza email",
      "Tono dell'AI personalizzabile",
      "Automazioni extra (promemoria di compleanno)",
      "Supporto prioritario",
      "Report e analytics avanzati",
    ],
    consigliato: false,
    // Vedi il commento sopra PIANI (aggiornamento 14/09/2026): il prezzo
    // include 1 operatore, non è più tutto compreso a prescindere da quanti
    // ce ne sono, come invece resta per Starter/Growth ("operatori
    // illimitati").
    notaPrezzo: notaOperatoreExtra("pro"),
  },
  {
    nome: "Enterprise",
    prezzo: "Su misura",
    periodo: "",
    descrizione: "Per catene e gruppi.",
    // Aggiornamento 16/09/2026 (Fase 5, migrazione 0027): "Multi-sede e
    // ruoli avanzati" era una promessa senza niente sotto. Ora esiste
    // davvero, ma non nella forma che quella riga lasciava immaginare, e le
    // due voci separate dicono esattamente cosa si compra:
    //   - "Più sedi, un solo accesso": ogni sede resta un'attività a sé (con
    //     la sua pagina pubblica, i suoi orari, il suo personale) e un unico
    //     account ci passa in mezzo con un selettore. La seconda sede la
    //     collega Gabriel in fase di onboarding, che su un piano "su misura"
    //     è esattamente come deve funzionare -- non c'è un pulsante
    //     self-service, e non va promesso.
    //   - "Ruoli e permessi": owner/staff applicati per davvero (vedi
    //     src/lib/ruoli.ts) -- un collaboratore lavora sull'agenda ma non
    //     vede il fatturato, non cambia prezzi e non tocca l'abbonamento.
    // 17/09/2026: "App installabile (PWA)" era elencata QUI come vantaggio
    // esclusivo di Enterprise, ma il manifest (`src/app/manifest.ts`) e il
    // service worker (`src/app/registra-service-worker.tsx`) sono serviti a
    // chiunque, su ogni piano -- e `Funzionalita.tsx` la elencava già come
    // funzione generale. Le due pagine si contraddicevano. Tolta da qui:
    // resta vera dove è vera, cioè per tutti.
    voci: [
      "Tutto di Pro",
      "Più sedi, un solo accesso",
      "Configurazione e collegamento delle sedi fatti da noi",
      "Supporto dedicato",
    ],
    consigliato: false,
  },
];

/**
 * Effetto "metal liquido" sui pulsanti dei piani a pagamento (terzo giro,
 * richiesta di Gabriel: "più paghi più è bello e premium il metal" -- non lo
 * stesso identico shader ovunque, ma un'intensità crescente con il prezzo).
 * Riusa lo stesso componente della Hero (`LiquidMetal`), solo parametri
 * diversi -- mai un secondo motore di shader da mantenere. `parallasse:
 * false` ovunque: il tilt che segue il mouse ha senso su una sezione a piena
 * pagina, non su un pulsante largo 150px, dove sarebbe solo un tremolio.
 * Free ed Enterprise restano fuori (Free non è un piano "premium" da
 * vendere, Enterprise è a preventivo via email, non un vero checkout).
 * Starter: palette argento/grigio (sobrio ma visibile come anello sottile).
 * Growth: la stessa identità viola/fucsia del sito, intensità media. Pro:
 * oro/champagne (vedi commento su METAL_PIANI.Pro più sotto), più
 * veloce/lucida -- il piano più caro ha il metal più vistoso E il colore più
 * distintivo, non solo un viola più intenso.
 *
 * Renderizzato come ANELLO sottile, non più a riempire tutto il pulsante
 * (quinto giro, feedback di Gabriel: "non sono male ma sono un po' strani").
 * Cercato ispirazione sui connettori (21st.dev, componente "metal-fx" di
 * larsen66): un bordo metallico animato attorno a un elemento qualunque, non
 * uno shader che riempie tutta la superficie cliccabile -- lo stesso schema
 * già usato in questo file per il bordo del piano "Consigliato" (GlowBorder
 * dentro un contenitore con qualche px di padding, un elemento pieno sopra).
 * Non installata la libreria esterna (`metal-fx`, dipendenza di terze parti
 * con licenza non verificata, per un sito con budget vicino a zero non ha
 * senso rischiare) -- stessa idea ricreata con `LiquidMetal`, che già
 * conosciamo e abbiamo verificato: un pulsante scuro pieno e leggibile, con
 * 2px di anello animato attorno invece che un vortice a piena card.
 */
const METAL_PIANI: Record<string, Partial<ComponentProps<typeof LiquidMetal>>> = {
  // `flow` (in LiquidMetal.tsx, `phase += dt * p.flow * 0.12`) è il
  // parametro che fa davvero avanzare il pattern nel tempo -- con `flow: 3`
  // (il valore più basso dei tre piani) insieme a una palette di grigi
  // tutti molto simili tra loro, il movimento c'era ma era troppo lento E
  // troppo poco visibile (grigi vicini che si scambiano piano non si nota
  // quasi) per leggersi come "vivo": segnalato da Gabriel come anello
  // "fermo" sul sito vero. Alzato `flow` e `sweep` allo stesso livello di
  // Growth -- il grigio/argento resta sobrio (la sobrietà è nella PALETTE,
  // grigio invece di viola/oro, non nella velocità), ma ora si muove
  // quanto gli altri due invece di sembrare statico.
  Starter: {
    colors: ["#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"],
    frost: 2.2,
    sweep: 4,
    shimmer: 3.5,
    scale: 5,
    flow: 5,
    refraction: 0.8,
    twist: 1.6,
    relief: 6,
  },
  Growth: {
    colors: ["#2e1065", "#4c1d95", "#7c3aed", "#c026d3"],
    frost: 1.6,
    sweep: 4,
    shimmer: 5,
    scale: 6,
    flow: 5,
    refraction: 1,
    twist: 2,
    relief: 8,
  },
  // Pro (quinto giro, feedback di Gabriel: "cambia colore del pro per
  // renderlo ancora piu pro"): prima usava la palette di default di
  // LiquidMetal (viola scuro -> viola -> fucsia -> rosa chiaro), la STESSA
  // famiglia di colore dell'anello di Growth appena sopra -- le due
  // sembravano varianti dello stesso piano, non due livelli diversi.
  // Oro/champagne è il codice colore universale del livello "top" (carte
  // Gold/Platinum, badge premium): un'unica interruzione cromatica dal
  // viola/fucsia che identifica il resto del sito, usata qui in un solo
  // anello sottile, non su tutta la pagina -- riconoscibile a colpo
  // d'occhio come "il piano più alto" senza reinterpretare l'identità del
  // brand.
  // Palette scaldata una seconda volta (quinto giro, seconda parte --
  // feedback di Gabriel dopo aver visto i pulsanti veri: "rendilo un po piu
  // oro, meno giallo/verde"). La prima versione (#d4a017/#f2cf7a) aveva un
  // divario R-G troppo piccolo per il canale verde -- letto come
  // giallo/senape sotto lo shimmer animato invece che come oro caldo.
  // Aumentato il distacco rosso-verde su ogni tappa (oro vero = molto rosso,
  // poco verde, un tocco di blu per la "temperatura calda") invece di un
  // giallo puro (rosso e verde vicini, blu quasi assente).
  //
  // Terzo aggiustamento (quinto giro, quarta parte -- Gabriel: "il pulsante
  // di pro tende ancora al verde, fa un po oro e un po verde, fai solo
  // oro"). Causa reale, trovata leggendo lo shader (LiquidMetal.tsx, non a
  // occhio): la funzione `hueShift()` ruota la tonalità dell'intera palette
  // avanti e indietro nel tempo -- `uHue = sin(shimmerPhase) * shimmer *
  // 0.05` radianti, con `shimmerPhase` che avanza a velocità COSTANTE
  // (`shimmer` controlla solo l'AMPIEZZA della rotazione, non la
  // velocità). Con `shimmer: 7` l'ampiezza è ±0.35 rad ≈ ±20°: la tonalità
  // oro della versione precedente (~31-42°, calcolato con `colorsys`) con
  // una rotazione di +20° finisce a ~51-62°, già dentro la zona
  // giallo-verde (il verde puro è a 120°, ma il confine percepito tra
  // "oro caldo" e "verde/senape" cade molto prima, intorno ai 55-65°) --
  // da qui l'oscillare percepito da Gabriel tra oro e verde. Ricalcolata
  // un'altra volta con `colorsys`, stavolta con tonalità molto più basse
  // (~22-34° invece di ~31-42°, tutte più vicine all'arancio-ruggine che al
  // giallo) in modo che anche il picco massimo della rotazione (+20°, fino
  // a ~54°) resti ancora saldamente nella zona oro/ambra e non sconfini mai
  // nel giallo-verde. Ridotto anche `shimmer` da 7 a 6 per restringere un
  // po' l'ampiezza stessa della rotazione (margine di sicurezza in più),
  // restando comunque sopra il 5 di Growth -- il piano più caro mantiene il
  // metal più vivace, solo con meno margine di rischio sul colore.
  Pro: {
    colors: ["#2d1406", "#6a3410", "#b8631e", "#df9449", "#f8e4c9"],
    frost: 1.1,
    sweep: 6,
    shimmer: 6,
    scale: 7,
    flow: 7,
    refraction: 1.4,
    twist: 2.6,
    relief: 10,
  },
};

// Collegato a Stripe l'11/09/2026: prima ogni card puntava a `/registrati`
// (creava sempre e solo un account Free, a prescindere dal piano cliccato --
// non esisteva ancora un vero checkout). Ora Starter/Growth/Pro portano alla
// registrazione con il piano scelto in query string (`?piano=...`): dopo la
// registrazione la dashboard apre da sola la Checkout Session Stripe (vedi
// AvviaCheckoutSeNecessario). Free resta un account gratuito puro, nessun
// passaggio da Stripe. Enterprise è a preventivo/gestito a mano -- "Richiedi
// info" deve aprire un'email, non creare silenziosamente un account.
function hrefVoceCTA(nome: string): string {
  switch (nome) {
    case "Starter":
      return "/registrati?piano=starter";
    case "Growth":
      return "/registrati?piano=growth";
    case "Pro":
      return "/registrati?piano=pro";
    case "Enterprise":
      return "mailto:gabrielmazzucchelli3@gmail.com?subject=Salone%20AI%20-%20Piano%20Enterprise";
    default:
      return "/registrati";
  }
}

export function Prezzi() {
  return (
    <section id="prezzi" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-24 sm:px-8">
      {/* Centrato (terzo giro, segnalazione di Gabriel: "alcuni titoli
          (prezzi-per chi è) sono allineati a sinistra e non al centro") --
          allineato con le altre sezioni. */}
      <Reveal className="mx-auto max-w-lg text-center">
        <h2 className="text-sm font-medium text-violet-400">Prezzi</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Cresci di piano quando ti serve, non prima.
        </p>
      </Reveal>

      {/* Bug segnalato da Gabriel: piani "di lunghezze diverse e storti" --
          causa reale: h-full sull'ultimo div non aveva un'altezza da cui
          ereditare, perché nessun antenato tra il grid item e lì aveva
          h-full esplicito (una griglia CSS stira il grid item stesso, ma
          non i suoi figli a cascata). Aggiunto h-full su RevealItem e sul
          wrapper -- ora le 5 card hanno sempre la stessa altezza di riga. */}
      <RevealStagger className="mt-12 grid items-stretch gap-4 lg:grid-cols-5" gapMs={0.06}>
        {PIANI.map((p) => (
          <RevealItem key={p.nome} className="h-full">
            {/* Bug segnalato da Gabriel: il badge "Consigliato" viveva DENTRO
                il flusso della card (prima di nome/prezzo) -- su Growth
                aggiungeva ~36px prima del titolo che le altre 4 card non
                avevano, quindi nome/prezzo/descrizione di Growth partivano
                più in basso delle altre e rompevano l'allineamento della
                riga ("rovina l'ordine"). Ora è un'etichetta assoluta che
                sporge SOPRA il bordo della card, fuori dal flusso -- il
                contenuto interno riparte identico su tutti e 5 i piani. */}
            <div className={`relative h-full rounded-2xl ${p.consigliato ? "p-px" : ""}`}>
              {p.consigliato && <GlowBorder rounded={14} borderWidth={1.5} speed={6} tailLength={45} glowColor="#f0abfc" tailColor="rgba(217,70,239,0.4)" baseColor="rgba(255,255,255,0.04)" />}
              {p.consigliato && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-md shadow-violet-950/40">
                  Consigliato
                </span>
              )}
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-5 text-white ${
                  p.consigliato
                    ? "border-transparent bg-white/[0.07] shadow-xl shadow-violet-600/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
              <h3 className={`text-sm font-medium ${p.consigliato ? "text-white/70" : "text-white/50"}`}>{p.nome}</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{p.prezzo}</span>
                <span className={`text-sm ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.periodo}</span>
              </div>
              <p className={`mt-1 text-xs ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.descrizione}</p>
              {"trial" in p && p.trial && (
                <p className="mt-1 text-xs font-medium text-emerald-400">10 giorni di prova, poi si paga</p>
              )}
              {"notaPrezzo" in p && p.notaPrezzo && (
                <p className={`mt-1 text-xs ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.notaPrezzo}</p>
              )}

              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.voci.map((v) => (
                  <li key={v} className={`flex items-start gap-2 ${p.consigliato ? "text-white/80" : "text-white/60"}`}>
                    <Check className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>

              {/* Bug reale segnalato da Gabriel (fisso ancora prima dello
                  Stripe checkout): "Inizia gratis" compariva anche su
                  Starter/Growth/Pro (€19,90-69,90), come se l'abbonamento a
                  pagamento partisse gratis -- confuso a ragione. Da quando
                  il checkout Stripe è collegato (11/09/2026), "Crea il tuo
                  account" è comunque il label più onesto per i piani a
                  pagamento: descrive il primo passo reale (l'account nasce
                  sempre prima, gratis), il secondo passo (pagamento
                  Stripe, con 10gg di prova su Growth) viene spiegato subito
                  dopo nella pagina di registrazione, non promesso qui.
                  "Inizia gratis" resta quindi riservato alla card Free,
                  l'unica dove è letteralmente l'intera storia. */}
              {(() => {
                const etichetta = p.nome === "Enterprise" ? "Richiedi info" : p.nome === "Free" ? "Inizia gratis" : "Crea il tuo account";
                const metal = METAL_PIANI[p.nome];
                if (metal) {
                  return (
                    <a href={hrefVoceCTA(p.nome)} className="relative mt-5 block rounded-full p-[2px] transition-transform hover:scale-[1.03]">
                      <LiquidMetal {...metal} parallasse={false} className="rounded-full" />
                      {/* Bug segnalato da Gabriel: "crea il tuo account" andava a
                          capo su Growth/Pro. Causa reale (misurata con Playwright,
                          non a occhio): a lg il testo misura ~125px, la colonna
                          della griglia lascia solo ~125-127px liberi dentro lo
                          span dopo il padding px-4 (16px per lato) -- un margine
                          di 0-2px, sotto la soglia di arrotondamento del
                          sub-pixel rendering (per questo in Safari reale andava a
                          capo su 2 piani su 3, non su tutti: differenze di
                          sub-pixel tra i tre span). Fix: padding orizzontale
                          ridotto (px-4 -> px-3, libera 8px per lato) per un
                          margine reale, più whitespace-nowrap esplicito così non
                          torna mai ad andare a capo anche se un font diverso
                          misurasse qualche px in più. */}
                      <span className="relative z-10 flex items-center justify-center rounded-full bg-zinc-900 px-3 py-2 text-center text-sm font-medium whitespace-nowrap text-white">
                        {etichetta}
                      </span>
                    </a>
                  );
                }
                return (
                  <a
                    href={hrefVoceCTA(p.nome)}
                    className="mt-5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {etichetta}
                  </a>
                );
              })()}
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
