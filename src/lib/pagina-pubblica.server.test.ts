import { describe, it, expect } from "vitest";
import { caricaProfiloPubblico } from "@/lib/pagina-pubblica.server";
import { creaSupabaseFinto } from "@/test/supabase-finto";

const TENANT_ROW = {
  id: "tenant-1",
  slug: "bella-hair",
  nome: "Bella Hair",
  descrizione: "Salone nel centro città",
  indirizzo: "Via Roma 1",
  telefono: "+39 333 1234567",
  email: "info@bellahair.it",
  sito_web: null,
  social: { instagram: "https://instagram.com/bellahair" },
  logo_url: null,
  cover_url: null,
  piano: "growth", // ha accesso alla chat AI web (vedi src/lib/ai/limiti.ts)
  caparra_attiva: false,
  caparra_tipo: "percentuale",
  caparra_valore: 20,
};

describe("caricaProfiloPubblico", () => {
  it("restituisce null se lo slug non corrisponde a nessun tenant (mai un profilo fabbricato)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: null, error: null }] },
    });

    const risultato = await caricaProfiloPubblico(supabase, "non-esiste");
    expect(risultato).toBeNull();
  });

  it("carica tenant + servizi attivi + operatori attivi + associazioni, con i nomi di campo convertiti", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_ROW, error: null }] },
      servizi: {
        select: [
          {
            data: [
              {
                id: "serv-1",
                nome: "Taglio",
                descrizione: null,
                categoria: "Capelli",
                durata_minuti: 30,
                prezzo_centesimi: 2500,
                immagine_url: null,
              },
            ],
            error: null,
          },
        ],
      },
      operatori: {
        select: [
          {
            data: [{ id: "op-1", nome: "Sara", foto_url: null, ruolo: "Titolare" }],
            error: null,
          },
        ],
      },
      operatori_servizi: {
        select: [{ data: [{ operatore_id: "op-1", servizio_id: "serv-1" }], error: null }],
      },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");

    expect(profilo).not.toBeNull();
    expect(profilo?.tenantId).toBe("tenant-1");
    expect(profilo?.nome).toBe("Bella Hair");
    expect(profilo?.chatAiAttiva).toBe(true); // piano "growth" -> ha la chat AI
    expect(profilo?.social).toEqual({ instagram: "https://instagram.com/bellahair" });
    expect(profilo?.servizi).toEqual([
      {
        id: "serv-1",
        nome: "Taglio",
        descrizione: null,
        categoria: "Capelli",
        durataMinuti: 30,
        prezzoCentesimi: 2500,
        immagineUrl: null,
      },
    ]);
    expect(profilo?.operatori).toEqual([
      { id: "op-1", nome: "Sara", fotoUrl: null, ruolo: "Titolare", servizioIds: ["serv-1"] },
    ]);
    expect(profilo?.caparra).toEqual({ attiva: false, tipo: "percentuale", valore: 20, regola: "tutti", sogliaNoShow: 1 });
  });

  it("caparra attiva/tipo/valore riflettono la configurazione del tenant", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        select: [
          { data: { ...TENANT_ROW, caparra_attiva: true, caparra_tipo: "fisso", caparra_valore: 1000 }, error: null },
        ],
      },
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.caparra).toEqual({ attiva: true, tipo: "fisso", valore: 1000, regola: "tutti", sogliaNoShow: 1 });
  });

  it("chatAiAttiva è false per un piano senza AI (es. free)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { ...TENANT_ROW, piano: "free" }, error: null }] },
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.chatAiAttiva).toBe(false);
  });

  it("haInformazioniAttivita è false su un piano Growth (ha solo la chat AI transazionale)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_ROW, error: null }] }, // piano "growth"
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.haInformazioniAttivita).toBe(false);
  });

  it("haInformazioniAttivita è true su un piano Pro (ha anche la knowledge base, Fase 2)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { ...TENANT_ROW, piano: "pro" }, error: null }] },
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.haInformazioniAttivita).toBe(true);
  });

  it("non interroga operatori_servizi se non ci sono operatori attivi (nessuna riga da filtrare)", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: TENANT_ROW, error: null }] },
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
      // Nessuna coda "operatori_servizi" configurata: se il codice la
      // interrogasse comunque, il client finto lancerebbe un errore esplicito
      // ("Nessuna risposta configurata...") e questo test fallirebbe.
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.operatori).toEqual([]);
  });

  it("social non valorizzato (null in colonna) diventa un oggetto vuoto, mai null", async () => {
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { ...TENANT_ROW, social: null }, error: null }] },
      servizi: { select: [{ data: [], error: null }] },
      operatori: { select: [{ data: [], error: null }] },
    });

    const profilo = await caricaProfiloPubblico(supabase, "bella-hair");
    expect(profilo?.social).toEqual({});
  });
});
