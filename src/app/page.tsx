import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ProdottoScroll } from "@/components/landing/ProdottoScroll";
import { PrimaDopo } from "@/components/landing/PrimaDopo";
import { ComeFunziona } from "@/components/landing/ComeFunziona";
import { Vetrina } from "@/components/landing/Vetrina";
import { PercheNoi } from "@/components/landing/PercheNoi";
import { Funzionalita } from "@/components/landing/Funzionalita";
import { PerChi } from "@/components/landing/PerChi";
import { Prezzi } from "@/components/landing/Prezzi";
import { CTAFinale } from "@/components/landing/CTAFinale";
import { Footer } from "@/components/landing/Footer";

/**
 * Landing page di presentazione del servizio (Fase 5bis, fuori dai 33 punti
 * originali -- richiesta esplicita di Gabriel l'11/09/2026: la SOLA pagina
 * dove vale la pena investire in un livello di rifinitura "top del top",
 * animazioni comprese, perché è il primo contatto di un libero professionista
 * col prodotto. Il resto dell'app (dashboard, pagina pubblica per-salone)
 * resta volutamente più sobrio -- vedi docs/librerie-ui.md per il perché e
 * quali librerie/connettori usare quando si tocca ancora questa pagina.
 *
 * Zero numeri o testimonianze finte: ogni cifra qui dentro (prezzi, limiti di
 * piano) viene da DECISIONS.md, non inventata per l'occasione.
 */
export const metadata: Metadata = {
  title: "Salone AI -- Prenotazioni, CRM e reception AI per il tuo salone",
  description:
    "La piattaforma tutto-in-uno per parrucchieri, barbieri, centri estetici e liberi professionisti: pagina di prenotazione online, CRM clienti e un'assistente AI che risponde 24/7.",
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <Nav />
      <Hero />
      <ProdottoScroll />
      <ComeFunziona />
      <PrimaDopo />
      <Vetrina />
      <PercheNoi />
      <Funzionalita />
      <PerChi />
      <Prezzi />
      <CTAFinale />
      <Footer />
    </div>
  );
}
