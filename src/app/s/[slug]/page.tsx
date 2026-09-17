import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { caricaProfiloPubblico } from "@/lib/pagina-pubblica.server";
import { caricaRecensioniPubbliche } from "@/lib/recensioni.server";
import FlussoPrenotazione from "./FlussoPrenotazione";
import ChatWidgetPubblico from "./ChatWidgetPubblico";
import { BarraDemo } from "./BarraDemo";
import { linkWhatsapp, numeroPerWhatsapp } from "@/lib/contatti";
import { formatoEuroDaCentesimi as formatoEuro } from "@/lib/piani";

/**
 * Pagina pubblica del salone (Fase 4, punto 15 di CLAUDE.md) -- l'unica
 * pagina di tutto il progetto pensata per essere vista da un cliente finale
 * anonimo, non dal titolare loggato. Server Component: profilo, servizi e
 * operatori sono caricati una volta sola qui (via il client admin, mai un
 * client autenticato -- vedi pagina-pubblica.server.ts per il perché) e
 * passati come props ai due soli componenti client necessari (il flusso di
 * prenotazione e il widget chat), che restano interattivi senza dover
 * ricaricare tutta la pagina.
 *
 * `React.cache` evita di interrogare due volte il database quando sia
 * `generateMetadata` sia il componente pagina chiedono lo stesso profilo
 * nella stessa richiesta (pattern standard Next.js App Router).
 */
const caricaProfiloCache = cache(async (slug: string) => {
  const supabase = creaClientAdmin();
  return caricaProfiloPubblico(supabase, slug);
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profilo = await caricaProfiloCache(slug);
  if (!profilo) return { title: "Attività non trovata" };
  return {
    title: `${profilo.nome} -- Prenota online`,
    description: profilo.descrizione ?? `Prenota un appuntamento online da ${profilo.nome}.`,
  };
}


const ETICHETTE_SOCIAL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export default async function PaginaPubblicaSalone({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ caparra?: string }>;
}) {
  const { slug } = await params;
  const { caparra: esitoCaparra } = await searchParams;
  const profilo = await caricaProfiloCache(slug);
  if (!profilo) notFound();

  const categorie = Array.from(new Set(profilo.servizi.map((s) => s.categoria ?? "Servizi")));

  // WhatsApp (17/09/2026). Il link si costruisce solo se il numero è
  // utilizzabile: meglio nessuna voce che una che apre una chat con nessuno.
  // Il numero si RIPETE accanto alla parola solo quando è diverso dal
  // telefono già mostrato -- altrimenti la riga dei contatti conterrebbe lo
  // stesso numero due volte di fila.
  const linkWa = linkWhatsapp(profilo.telefonoWhatsapp);
  const mostraNumeroWa =
    !!profilo.telefonoWhatsapp &&
    numeroPerWhatsapp(profilo.telefonoWhatsapp) !== numeroPerWhatsapp(profilo.telefono);

  // Fase 3, 16/09/2026: `null` se il titolare ha spento l'interruttore
  // generale (vedi 0026_recensioni.sql) -- in quel caso la sezione non
  // compare affatto, non solo vuota.
  const recensioniInfo = await caricaRecensioniPubbliche(creaClientAdmin(), profilo.tenantId);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {profilo.eDemo && <BarraDemo slug={slug} gruppo={profilo.demoGruppo} />}

      {/* ── hero ─────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-zinc-900 text-white">
        {profilo.coverUrl && (
          // Immagine caricata dal titolare (URL arbitrario in Supabase
          // Storage): un dominio non whitelistabile in anticipo per next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilo.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-4 px-5 py-16 sm:px-8 sm:py-20">
          {profilo.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilo.logoUrl}
              alt={profilo.nome}
              className="size-16 rounded-2xl border border-white/20 bg-white object-cover shadow-lg"
            />
          )}
          <h1 className="text-3xl font-semibold sm:text-4xl">{profilo.nome}</h1>
          {profilo.descrizione && <p className="max-w-xl text-white/80">{profilo.descrizione}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
            {profilo.indirizzo && <span>{profilo.indirizzo}</span>}
            {profilo.telefono && (
              <a href={`tel:${profilo.telefono}`} className="underline decoration-white/40 hover:text-white">
                {profilo.telefono}
              </a>
            )}
            {/* WhatsApp accanto al telefono (17/09/2026): è il canale su cui
                l'assistente manda chi ha bisogno di una persona, e chi
                arriva qui dalla chat deve ritrovarlo anche sulla pagina.
                Mostrato solo se il link regge (numero utilizzabile) e solo
                se il numero è DIVERSO dal telefono -- altrimenti sarebbero
                due voci identiche una accanto all'altra. */}
            {linkWa && (
              <a
                href={linkWa}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-white/40 hover:text-white"
              >
                WhatsApp{mostraNumeroWa ? ` ${profilo.telefonoWhatsapp}` : ""}
              </a>
            )}
            {profilo.email && (
              <a href={`mailto:${profilo.email}`} className="underline decoration-white/40 hover:text-white">
                {profilo.email}
              </a>
            )}
            {profilo.sitoWeb && (
              <a href={profilo.sitoWeb} target="_blank" rel="noreferrer" className="underline decoration-white/40 hover:text-white">
                Sito web
              </a>
            )}
            {Object.entries(profilo.social).map(([rete, url]) => (
              <a key={rete} href={url} target="_blank" rel="noreferrer" className="underline decoration-white/40 hover:text-white">
                {ETICHETTE_SOCIAL[rete] ?? rete}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
        {/* ── prenotazione (in cima: è l'azione principale della pagina) ── */}
        <section id="prenota" className="scroll-mt-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Prenota online</h2>
          {esitoCaparra === "successo" && (
            <p className="mb-4 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              Pagamento ricevuto, prenotazione confermata! Ti aspettiamo.
            </p>
          )}
          {esitoCaparra === "annullata" && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Pagamento annullato: la prenotazione non è stata confermata, nessun addebito effettuato.
            </p>
          )}
          <FlussoPrenotazione slug={slug} servizi={profilo.servizi} operatori={profilo.operatori} caparra={profilo.caparra} />
        </section>

        {/* ── servizi (catalogo consultabile, stessi dati del flusso sopra) ── */}
        {profilo.servizi.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">I nostri servizi</h2>
            <div className="flex flex-col gap-6">
              {categorie.map((categoria) => (
                <div key={categoria}>
                  {categorie.length > 1 && (
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">{categoria}</h3>
                  )}
                  <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                    {profilo.servizi
                      .filter((s) => (s.categoria ?? "Servizi") === categoria)
                      .map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{s.nome}</p>
                            {s.descrizione && <p className="text-xs text-zinc-400">{s.descrizione}</p>}
                            <p className="mt-0.5 text-xs text-zinc-400">{s.durataMinuti} min</p>
                          </div>
                          <span className="shrink-0 text-sm font-medium text-zinc-900">{formatoEuro(s.prezzoCentesimi)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── team ─────────────────────────────────────────── */}
        {profilo.operatori.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Il team</h2>
            <div className="flex flex-wrap gap-4">
              {profilo.operatori.map((o) => (
                <div key={o.id} className="flex w-24 flex-col items-center gap-2 text-center">
                  {o.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.fotoUrl} alt={o.nome} className="size-16 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-500">
                      {o.nome.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-medium text-zinc-900">{o.nome}</p>
                    {o.ruolo && <p className="text-[11px] text-zinc-400">{o.ruolo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* ── recensioni (Fase 3, sparisce del tutto se il titolare ha spento
             l'interruttore, o se non ce ne sono ancora) ─────────────────── */}
        {recensioniInfo && recensioniInfo.recensioni.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Recensioni</h2>
            {recensioniInfo.media.media !== null && (
              <p className="mb-4 text-sm text-zinc-500">
                <span className="text-amber-500">★</span> {recensioniInfo.media.media} su 5 ({recensioniInfo.media.totale}{" "}
                recensioni)
              </p>
            )}
            <div className="flex flex-col gap-4">
              {recensioniInfo.recensioni.map((r, i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-400" aria-label={`${r.valutazione} stelle su 5`}>
                      {"★".repeat(r.valutazione)}
                      <span className="text-zinc-200">{"★".repeat(5 - r.valutazione)}</span>
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(r.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-zinc-500">{r.nomeCliente}</p>
                  {r.commento && <p className="mt-2 text-sm text-zinc-800">{r.commento}</p>}
                  {r.rispostaTitolare && (
                    <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2">
                      <p className="text-xs font-medium text-zinc-500">Risposta di {profilo.nome}</p>
                      <p className="mt-0.5 text-sm text-zinc-700">{r.rispostaTitolare}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-400">
        Pagina di {profilo.nome} -- prenotazioni gestite online.
      </footer>

      {profilo.chatAiAttiva && (
        <ChatWidgetPubblico slug={slug} nomeAttivita={profilo.nome} haInformazioniAttivita={profilo.haInformazioniAttivita} />
      )}
    </div>
  );
}
