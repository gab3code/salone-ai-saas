"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Check, MessageCircle, Sparkles } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, animate, useMotionTemplate } from "framer-motion";
import { Grana } from "./Grana";
import { MagneticButton } from "./MagneticButton";
import { LiquidMetal } from "./LiquidMetal";
import { FlipWords } from "./FlipWords";

const PROFESSIONI = ["salone", "studio", "centro", "spazio"];

/** Riflesso che attraversa il testo del titolo in loop (quinto giro, terza
 * parte -- Gabriel, guardando il sito vero: "più metallico come i bottoni è
 * meglio"). I pulsanti "metal" di Prezzi.tsx hanno un vero shader WebGL
 * (LiquidMetal) con parametri chiamati proprio `shimmer`/`sweep`; usare lo
 * stesso shader come riempimento del testo (via un mask CSS che ritaglia il
 * canvas sulla forma delle lettere) è fragile da verificare -- in questa
 * sandbox il contesto WebGL non regge MAI (vedi note nei giri precedenti),
 * quindi qualunque bug nel mask non lo scoprirei prima di Gabriel, e serve
 * far combaciare a pixel i metrics del font in un SVG separato a ogni
 * breakpoint. Stessa idea (`shimmer`/`sweep`, un riflesso che si muove)
 * ricreata in puro CSS/Framer Motion invece che con WebGL -- un gradiente
 * chiaro che attraversa il riempimento scuro in loop, verificabile qui
 * (è solo `background-position` animato, nessun canvas). */
function useRiflessoMetallico() {
  const posizione = useMotionValue(200);
  const backgroundPosition = useMotionTemplate`${posizione}% 0`;

  useEffect(() => {
    const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (riduciMovimento) return;
    // Rallentato (quinto giro, quarta parte -- Gabriel: "rallenta
    // l'animazione") -- da 3.2s a 6s per passata, pausa più lunga tra un
    // passaggio e l'altro: un riflesso che si nota con calma, non un lampo.
    const controlli = animate(posizione, [200, -100], {
      duration: 6,
      repeat: Infinity,
      repeatDelay: 2.2,
      ease: "easeInOut",
    });
    return () => controlli.stop();
  }, [posizione]);

  return backgroundPosition;
}

/** Quinto giro, sesta parte -- Gabriel: "vedi se il titolo può diventare più
 * bello" (richiesta aperta, dopo aver già visto i colori Growth). Il riflesso
 * automatico sopra (`useRiflessoMetallico`) è un loop fisso, sempre uguale,
 * indipendente da cosa fa chi guarda -- corretto come "ambiente" ma da solo
 * non rende il titolo "vivo" quanto il resto della Hero: LiquidMetal sotto
 * reagisce già al mouse (tilt + alone, vedi LiquidMetal.tsx) mentre il testo
 * sopra restava statico rispetto al cursore. Aggiunta qui una seconda
 * reazione, indipendente dal riflesso automatico (mai sostituito, solo
 * affiancato): un lieve tilt 3D del titolo intero + un riflesso puntuale che
 * segue davvero il cursore, cosi la scritta sembra la stessa lastra
 * metallica lucida dello sfondo sotto, non un'immagine piatta appoggiata
 * sopra. Un solo listener su `window` (non sull'elemento): il contenitore
 * della Hero è `pointer-events-none` apposta (vedi commento in Hero(), serve
 * a lasciar passare il mouse a LiquidMetal) quindi un listener sull'h1 stesso
 * non riceverebbe mai l'evento -- `window` funziona a prescindere da quale
 * elemento sia il bersaglio dell'hit-test, stessa immunità di cui già
 * beneficia LiquidMetal sul proprio contenitore. Rispetta
 * `prefers-reduced-motion` come il resto del file: nessun listener aggiunto
 * per chi lo richiede, il titolo resta semplicemente fermo. */
function useLuceInterattiva() {
  const radiceRef = useRef<HTMLHeadingElement>(null);
  const puntoX = useMotionValue(50);
  const puntoY = useMotionValue(50);
  const inclinazioneXGrezza = useMotionValue(0);
  const inclinazioneYGrezza = useMotionValue(0);
  // Molla invece di un valore diretto: un tilt che scatta di netto ad ogni
  // pixel di movimento del mouse legge come nervoso, non come "lastra
  // pesante che si inclina" -- stessa idea dello smorzamento già usato per
  // il riflesso automatico, qui con una molla vera perché il bersaglio
  // cambia in continuazione (non un'animazione a due soli estremi).
  const inclinazioneX = useSpring(inclinazioneXGrezza, { stiffness: 180, damping: 20, mass: 0.4 });
  const inclinazioneY = useSpring(inclinazioneYGrezza, { stiffness: 180, damping: 20, mass: 0.4 });
  const [attivo, setAttivo] = useState(false);

  useEffect(() => {
    const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (riduciMovimento) return;

    function alMovimento(e: MouseEvent) {
      const el = radiceRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      // Un margine oltre i bordi veri del testo (non solo 0..1): il tilt e
      // il riflesso restano attivi avvicinandosi al titolo, non solo
      // passandoci esattamente sopra pixel per pixel -- più naturale su una
      // scritta larga quanto mezza pagina.
      const dentro = nx > -0.25 && nx < 1.25 && ny > -0.6 && ny < 1.6;
      setAttivo(dentro);
      if (!dentro) return;
      puntoX.set(Math.min(1, Math.max(0, nx)) * 100);
      puntoY.set(Math.min(1, Math.max(0, ny)) * 100);
      // Gradi piccoli apposta (max ~5°): il titolo deve sembrare una lastra
      // rigida che si inclina leggermente, non una carta che si piega -- lo
      // stesso principio di misura del tilt di LiquidMetal (lì 9° su tutto
      // lo sfondo, qui meno perché il testo è un elemento piccolo e già
      // ricco di dettaglio, un tilt vistoso quanto quello dello sfondo
      // sembrerebbe traballante).
      inclinazioneXGrezza.set((0.5 - ny) * 5);
      inclinazioneYGrezza.set((nx - 0.5) * 5);
    }
    function alReset() {
      setAttivo(false);
      inclinazioneXGrezza.set(0);
      inclinazioneYGrezza.set(0);
    }
    window.addEventListener("mousemove", alMovimento);
    window.addEventListener("mouseleave", alReset);
    return () => {
      window.removeEventListener("mousemove", alMovimento);
      window.removeEventListener("mouseleave", alReset);
    };
  }, [puntoX, puntoY, inclinazioneXGrezza, inclinazioneYGrezza]);

  return { radiceRef, puntoX, puntoY, inclinazioneX, inclinazioneY, attivo };
}

function Titolo() {
  const riflessoBackgroundPosition = useRiflessoMetallico();
  const { radiceRef, puntoX, puntoY, inclinazioneX, inclinazioneY, attivo } = useLuceInterattiva();
  const riflessoPuntuale = useMotionTemplate`radial-gradient(180px circle at ${puntoX}% ${puntoY}%, rgba(255,255,255,0.95), rgba(240,171,252,0.4) 45%, transparent 72%)`;
  // Quinto giro, settima parte -- "prenditi tutto il tuo tempo per
  // migliorarlo": il tilt aggiunto nella sesta parte muoveva tutto il
  // titolo come un pannello rigido, ma le BANDE di metallo sotto restavano
  // sempre nella stessa posizione relativa alle lettere -- un vero metallo
  // spazzolato, inclinandolo, mostra bande diverse (la superficie riflette
  // punti diversi dell'ambiente a seconda dell'angolo). Lego quindi la
  // posizione verticale del gradiente a bande allo stesso valore di tilt
  // (`inclinazioneX`, il componente "su/giù"): la spanna di gradiente è più
  // alta del testo (`backgroundSize: "100% 160%"`) apposta, cosi scorrendo
  // resta sempre dentro l'immagine (mai un bordo scoperto) e le due tinte
  // scure agli estremi del gradiente (`#110722` in cima e in fondo)
  // coprono comunque il caso limite senza cuciture visibili.
  const spostamentoBandeY = useTransform(inclinazioneX, [-5, 5], [32, 68]);
  const posizioneBande = useMotionTemplate`50% ${spostamentoBandeY}%`;
  return (
    <motion.h1
      ref={radiceRef}
      className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-6xl"
      style={{
        textShadow: "0 2px 28px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6)",
        rotateX: inclinazioneX,
        rotateY: inclinazioneY,
        transformPerspective: 900,
      }}
    >
      <span className="block overflow-hidden">
        <motion.span
          className="block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          Il tuo <FlipWords parole={PROFESSIONI} />,
        </motion.span>
      </span>
      <span className="block overflow-hidden" style={{ paddingBottom: "0.14em" }}>
        <motion.span
          className="block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Prima: testo in gradient viola->fucsia (bg-clip-text) sopra lo
              stesso shader viola->fucsia dell'Hero -- a seconda della fase
              dello shader il testo poteva finire quasi dello stesso colore
              dello sfondo dietro, leggendo come "sporco"/illeggibile invece
              che come un accento (segnalato da Gabriel, "colore orrendo").
              Passato poi a bianco pieno con un bagliore colorato attorno
              (text-shadow viola/fucsia) -- ma quel bagliore leggeva come
              un'"evidenziazione" indesiderata (segnalato di nuovo:
              "togli l'evidenziazione... dai un colore bello al testo").
              Passato poi ad ambra pieno -- ma l'ombra scura ereditata
              dall'h1 (28px di sfocatura, pensata per leggibilità su testo
              BIANCO sottile) dietro lettere ambra larghe e sature restava
              visibile come lo stesso alone sfocato di prima, e il colore
              ambra non piaceva.

              Passato poi a un unico contorno argentato sottile (1.4px) su
              riempimento scuro -- bocciato da Gabriel ("orrendo", "l'effetto
              metallico è inesistente") con screenshot del sito vero alla
              mano. Causa reale dell'errore: avevo verificato il colore solo
              con un finto sfondo scuro uniforme (lo sfondo di CTAFinale),
              ma lo sfondo VERO della Hero non è affatto scuro -- è un vortice
              chiaro, saturo, a tratti quasi bianco (viola/fucsia/rosa
              chiarissimo). Un contorno argentato chiaro sparisce proprio
              dove serve di più (sopra le zone chiare dello shader), lasciando
              solo un riempimento scuro con un contorno visibile a tratti: né
              "metallico" né leggibile in modo consistente.

              Ora: contorno a DUE TONI (tecnica standard per un bordo
              multicolore su testo, impossibile con un solo
              -webkit-text-stroke che accetta un colore solo) -- tre copie
              identiche del testo impilate esattamente una sull'altra
              (`display: grid`, stessa `gridArea` per tutte) invece di una
              sola:
                1) sotto: riempimento scuro + contorno NERO spesso (4px) --
                   il bordo esterno, garantisce contrasto anche sulle zone
                   più chiare/bianche dello shader;
                2) in mezzo: stesso riempimento + contorno ARGENTO chiaro più
                   sottile (2px), che copre la metà interna del contorno nero
                   sottostante -- resta visibile solo un anello sottile
                   d'argento appena dentro il bordo nero;
                3) sopra: solo riempimento (nessun contorno), copre la parte
                   di anello che cadrebbe dentro la lettera stessa.
              Risultato per ogni lettera, dal centro verso l'esterno:
              riempimento scuro pieno -> sottile anello argento -> sottile
              bordo nero -> sfondo. Leggibile e "metallico" a qualunque fase
              dello shader, chiara o scura che sia -- non più un solo
              contorno che dipende dal colore dietro in quel momento.
              Un'unica ombra portata (`filter: drop-shadow`, non
              `text-shadow`: si applica una volta sola alla forma composta
              invece di triplicarsi su ognuna delle quattro copie) per la
              profondità, sfocatura minima.

              Bug reale trovato DOPO aver mandato i primi screenshot a
              Gabriel ("ha uno sfondo nero ed è troppo scuro e poco
              metallico"): avevo scritto il commento sopra come se l'alone
              da 28px ereditato dall'h1 non ci fosse più, ma non avevo mai
              aggiunto `textShadow: "none"` da nessuna parte -- `text-shadow`
              è una proprietà EREDITATA, quindi tutt'e quattro le copie
              impilate qui sotto continuavano a ricevere lo stesso alone
              scuro da 28px di sfocatura dell'h1 (due delle quattro copie
              hanno un riempimento OPACO, quindi la loro ombra ereditata era
              perfettamente visibile) -- un alone scuro enorme dietro tutta
              la frase, che leggeva come uno "sfondo nero" e schiacciava
              visivamente le bande di metallo sotto. Serviva l'override
              esplicito qui sul contenitore (si eredita in giù su tutti i
              figli), non bastava intenzione + il drop-shadow separato.

              Quinto giro, quarta parte -- Gabriel, guardando ancora il sito
              vero: "ce ancora lo sfondo sfumato scuro dietro la frase".
              Il `text-shadow` era già a "none" (bug precedente già corretto),
              ma restava un secondo effetto separato -- un
              `filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55))` messo qui
              apposta per dare profondità alla scritta senza triplicarsi su
              ognuna delle quattro copie impilate (a differenza di
              text-shadow, che si eredita per ognuna). Anche con un raggio di
              sfocatura modesto (5px) e opacità non altissima (0.55), un
              drop-shadow scuro sopra uno sfondo già chiaro/saturo (il vortice
              della Hero) resta visibile proprio come una "sfumatura scura"
              intorno alla frase -- l'occhio lo legge come un alone, non come
              profondità. Tolto del tutto: le due copie di contorno (nera
              spessa fuori, argento chiara dentro) danno già abbastanza
              contrasto e leggibilità su qualunque fase dello shader, senza
              bisogno di un'ombra portata aggiuntiva. Risultato più pulito,
              più vicino a uno stile "Apple" (nessun bagliore/alone dietro il
              testo, solo il metallo). */}
          <span className="relative inline-grid" style={{ textShadow: "none" }}>
            <span style={{ gridArea: "1 / 1", color: "#1a1224", WebkitTextStroke: "4px #110722" }}>
              mai più senza risposta.
            </span>
            {/* Quinto giro, quinta parte -- Gabriel, guardando ancora il
                titolo accanto al pulsante Growth: "è un metallico poco
                premium... poco lucido e troppo opaco, prendi spunto dal
                colore dei pulsanti, tipo il pulsante di growth, non riesci a
                dare il bordo ad ogni lettera come il bordo viola metallico
                del pulsante growth?". Il contorno chiaro (questa copia) e le
                bande sotto usavano una tinta viola DESATURATA apposta (vedi
                commento della terza parte più sotto: "i metalli sono per
                natura desaturati anche quando hanno una tinta") -- scelta
                corretta per un metallo "argento tendente al viola", ma
                Gabriel non vuole quello: vuole letteralmente gli STESSI
                colori saturi del pulsante Growth (`METAL_PIANI.Growth.colors`
                in Prezzi.tsx: #2e1065 -> #4c1d95 -> #7c3aed -> #c026d3),
                calcolati con `colorsys` sulla base di quei 4 valori esatti
                (non a occhio) invece di una nuova palette desaturata
                inventata da zero. Contorno chiaro portato a un fucsia
                acceso chiarissimo (`#efc1f6`, lo stop più chiaro di Growth
                schiarito ulteriormente) per leggere come un vero riflesso
                metallico, non più un lilla spento. */}
            <span style={{ gridArea: "1 / 1", color: "#1a1224", WebkitTextStroke: "2px #efc1f6" }}>
              mai più senza risposta.
            </span>
            {/* Riempimento "metallo spazzolato" -- quinto giro, quinta
                parte: non più una palette desaturata "argento-viola" ma le
                4 tinte VERE del pulsante Growth, ripetute più volte con uno
                schema chiaro-scuro-chiaro (come una superficie di metallo
                spazzolato reale, che riflette la luce a bande, non con un
                unico gradiente morbido da un capo all'altro) -- più bande di
                passaggio chiaro/scuro = più "lucido" percepito, la stessa
                tecnica usata per il testo "cromato" nel web design.
                Settima parte -- la posizione verticale ora segue il tilt
                (vedi `spostamentoBandeY` sopra): inclinando il titolo le
                bande scorrono, come se riflettessero davvero l'ambiente
                intorno invece di restare incollate alle lettere. */}
            <motion.span
              style={{
                gridArea: "1 / 1",
                backgroundImage:
                  "linear-gradient(180deg, #110722 0%, #4c1d95 12%, #c026d3 24%, #7c3aed 36%, #2e1065 48%, #efc1f6 62%, #7c3aed 76%, #4c1d95 88%, #110722 100%)",
                backgroundSize: "100% 160%",
                backgroundPosition: posizioneBande,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              mai più senza risposta.
            </motion.span>
            {/* Riflesso che attraversa il testo in loop (vedi
                useRiflessoMetallico sopra): una fascia chiara, trasparente
                altrove, che scorre sulle bande statiche qui sopra -- come lo
                `shimmer` dei pulsanti metal di Prezzi.tsx, ma in puro
                CSS/Framer Motion invece che con lo stesso shader WebGL (che
                qui in sandbox non regge mai, vedi giri precedenti -- un
                eventuale bug nel mask non lo scoprirei prima di Gabriel).
                Quinto giro, quinta parte -- insieme alle bande più sopra,
                schiarito il nucleo del riflesso a un quasi-bianco (prima era
                un lilla tenue, troppo debole per leggersi come un vero
                riflesso lucido) e passato da `mixBlendMode: "overlay"` a
                `"screen"` -- "overlay" scurisce le zone già scure della
                banda (contro-intuitivo per un riflesso, che dovrebbe sempre
                schiarire), "screen" schiarisce sempre, indipendentemente dal
                colore sotto: più vicino a un vero bagliore di luce che
                attraversa una superficie lucida. */}
            <motion.span
              style={{
                gridArea: "1 / 1",
                backgroundImage:
                  "linear-gradient(100deg, transparent 0%, transparent 32%, rgba(240,171,252,0.25) 42%, rgba(255,255,255,0.92) 50%, rgba(240,171,252,0.25) 58%, transparent 68%, transparent 100%)",
                backgroundSize: "260% 100%",
                backgroundPosition: riflessoBackgroundPosition,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                mixBlendMode: "screen",
              }}
            >
              mai più senza risposta.
            </motion.span>
            {/* Riflesso puntuale che segue il mouse davvero (vedi
                useLuceInterattiva sopra), affiancato al riflesso automatico
                appena sopra -- non lo sostituisce: da fermi il titolo
                mantiene lo stesso loop già tarato nella quinta parte, solo
                muovendo il cursore si accende anche questo secondo bagliore,
                più piccolo e concentrato (180px), che segue il punto esatto
                sotto il cursore invece di scorrere in una sola direzione.
                Opacità animata invece di uno scatto secco: cresce/scompare
                in 300ms quando il cursore entra/esce dall'area del titolo,
                mai un bagliore che appare/sparisce di colpo. */}
            <motion.span
              style={{
                gridArea: "1 / 1",
                backgroundImage: riflessoPuntuale,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                mixBlendMode: "screen",
              }}
              animate={{ opacity: attivo ? 1 : 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              mai più senza risposta.
            </motion.span>
          </span>
        </motion.span>
      </span>
    </motion.h1>
  );
}

/** Il mock del prodotto della hero: NON una demo cliccabile -- un'illustrazione animata
 * (dati d'esempio, mai spacciati per statistiche reali) di cosa succede davvero dietro le
 * quinte: una prenotazione arriva sulla pagina pubblica, l'AI risponde, il calendario si aggiorna.
 * Stesso principio del resto del prodotto (punto 7 di CLAUDE.md, "l'AI non deve inventare dati")
 * esteso al marketing: qui non ci sono numeri finti, solo un esempio di flusso. */
function AnteprimaProdotto() {
  const APPUNTAMENTI = [
    { ora: "10:00", nome: "Marco R.", servizio: "Barba e capelli" },
    { ora: "11:30", nome: "Giulia B.", servizio: "Taglio e piega" },
    { ora: "15:00", nome: "Sara V.", servizio: "Colore" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative mx-auto mt-14 w-full max-w-3xl"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-orange-400/20 blur-2xl" />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs text-white/40">salone-ai-saas.vercel.app/s/il-tuo-salone</span>
        </div>

        <div className="grid gap-px bg-white/5 sm:grid-cols-[1.3fr_1fr]">
          {/* calendario che si popola da solo */}
          <div className="bg-zinc-900/95 p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/50">
              <Calendar className="size-3.5" /> Oggi
            </div>
            <div className="flex flex-col gap-2">
              {APPUNTAMENTI.map((a, i) => (
                <motion.div
                  key={a.ora}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 1.1 + i * 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-white/80">
                    <span className="font-medium text-white">{a.ora}</span> · {a.nome}
                  </span>
                  <span className="text-xs text-white/40">{a.servizio}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* chat AI che risponde da sola */}
          <div className="flex flex-col justify-end gap-2 bg-zinc-900/95 p-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/50">
              <MessageCircle className="size-3.5" /> Assistente AI
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.9 }}
              className="self-end rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-white/80"
            >
              Avete un buco domani pomeriggio per un taglio?
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 2.4 }}
              className="flex items-start gap-2 self-start rounded-2xl rounded-bl-sm bg-gradient-to-br from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs text-white"
            >
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              {/* Prima diceva "con Marco" -- ma il calendario a sinistra
                  mostra già un cliente chiamato "Marco R." alle 10:00: lo
                  stesso nome riusato per quello che sembra un operatore
                  diverso leggeva come un errore, non come un esempio pulito
                  (segnalato da Gabriel, "l'esempio concreto è strano").
                  Tolto il nome: la risposta resta vera qualunque sia la
                  struttura del salone (anche a operatore singolo). */}
              Sì! Domani alle 16:30, ti va bene?
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 3 }}
              className="mt-1 flex items-center gap-1.5 self-start text-[11px] text-emerald-400"
            >
              <Check className="size-3" /> Prenotazione confermata sul calendario
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <div id="top" className="relative isolate overflow-hidden bg-noir">
      {/* Liquid Metal (OriginKit, vedi docs/librerie-ui.md "Giro 3"): l'unico
          "protagonista" visivo della hero -- niente altri sfondi animati in
          competizione. Reagisce lievemente al mouse (tilt dello sfondo), mai
          al cursore reale. */}
      <LiquidMetal />
      {/* velo scuro dietro al blocco di testo: garantisce leggibilità del
          titolo qualunque sia il colore dello shader in quel momento */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 50% 34%, rgba(5,1,8,0.72), transparent 75%)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <Grana opacita={0.045} />
      {/* Bug segnalato da Gabriel ("la home appena apro il sito è tagliata
          sotto"): la Hero finisce di netto nel suo sfondo animato
          (LiquidMetal, ricco di colore) e la sezione successiva
          (ProdottoScroll) è un bg-noir piatto -- stesso colore di base, ma
          nessuna transizione tra "shader vivo" e "sfondo piatto" produce uno
          spigolo netto proprio all'altezza del mockup del prodotto. Un fade
          in gradiente verso bg-noir negli ultimi ~8rem della Hero ammorbidisce
          il passaggio, senza toccare nulla della sezione sotto (che resta lo
          stesso mockup della dashboard, "tagliata" solo perché tornerà dritta
          allo scroll -- vedi ProdottoScroll.tsx). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-noir sm:h-48" />

      {/* Bug segnalato da Gabriel: "deve reagire al mouse ma così non
          reagisce". Causa reale, verificata puntando il mouse e leggendo
          `document.elementFromPoint` in ogni punto della hero: questo div
          (badge, titolo, paragrafo, bottoni, mockup) è trasparente ma resta
          `pointer-events: auto` di default -- occupa quasi tutta l'altezza
          della hero nella colonna centrale, quindi "ruba" il mouseover a
          LiquidMetal ovunque tranne nei margini vuoti ai lati (che su un
          laptop da 13-15" sono strettissimi o assenti). Lo sfondo reagiva
          SOLO in quei margini, mai dove l'utente guarda davvero -- da qui la
          sensazione "non reagisce". Fix: questo contenitore diventa
          "trasparente anche al mouse" (pointer-events-none), così il
          movimento passa sempre a LiquidMetal sotto; solo i due bottoni
          (l'unica cosa qui dentro che deve restare cliccabile) riattivano
          pointer-events sul proprio contenitore. */}
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pt-28 pb-20 text-center sm:px-8 sm:pt-36 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70"
        >
          <Sparkles className="size-3.5 text-fuchsia-300" />
          Prenotazioni, CRM e reception AI in un&apos;unica piattaforma
        </motion.div>

        <Titolo />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 max-w-xl text-base text-white/70 sm:text-lg"
          style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}
        >
          I tuoi clienti prenotano da soli dalla tua pagina, un&apos;assistente AI risponde a chi
          scrive fuori orario, e tu vedi tutto in un unico calendario — senza cambiare il modo
          in cui lavori oggi.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {/* Stessa scelta applicata a Nav.tsx (richiesta di Gabriel
              dell'11/09/2026): anche il CTA principale della hero ora scende
              ai piani invece di portare dritti a /registrati. Prima i due
              bottoni "Inizia gratis" del sito (questo e quello in nav)
              avevano comportamenti diversi -- incoerente, ed è proprio questo
              il pulsante più in vista di tutti. Il testo resta vero: da
              Prezzi in giù si arriva comunque al piano Free senza carta. */}
          <MagneticButton
            href="#prezzi"
            className="block rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow-lg shadow-white/10"
          >
            Inizia gratis — nessuna carta richiesta
          </MagneticButton>
          <MagneticButton
            href="#funzionalita"
            forza={0.25}
            className="inline-block rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            Guarda come funziona
          </MagneticButton>
        </motion.div>

        <AnteprimaProdotto />
      </div>
    </div>
  );
}
