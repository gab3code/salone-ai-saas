/**
 * Logica pura per l'upload di logo/copertina del salone (Fase 4, galleria
 * foto -- vedi PIANO.md e migrazione 0024_storage_media_tenant.sql). Zero
 * dipendenze da Supabase qui: solo le regole di validazione e la
 * convenzione di percorso, condivise tra l'azione server e i suoi test.
 *
 * Percorso SENZA estensione nel nome file ("<tenant_id>/logo",
 * "<tenant_id>/cover"): il content-type viene salvato come metadato
 * dell'oggetto al momento dell'upload, non serve tracciare l'estensione
 * originale. Un nuovo caricamento sovrascrive il precedente (upsert),
 * niente file orfani da ripulire.
 */

export const TIPI_MEDIA_TENANT = ["logo", "cover"] as const;
export type TipoMediaTenant = (typeof TIPI_MEDIA_TENANT)[number];

export const BUCKET_MEDIA_TENANT = "media-tenant";

/** Stessi tipi/limite dichiarati sul bucket (migrazione 0024) -- duplicati qui
 * solo per dare all'utente un errore leggibile PRIMA di tentare l'upload,
 * non per sostituire il controllo lato Storage (che resta l'autorità vera). */
export const MIME_TYPE_CONSENTITI = ["image/jpeg", "image/png", "image/webp"] as const;
export const DIMENSIONE_MASSIMA_BYTES = 4 * 1024 * 1024; // 4MB

const ETICHETTE_TIPO_MEDIA: Record<TipoMediaTenant, string> = {
  logo: "Logo",
  cover: "Foto di copertina",
};

export function etichettaTipoMedia(tipo: TipoMediaTenant): string {
  return ETICHETTE_TIPO_MEDIA[tipo];
}

export function percorsoOggettoMedia(tenantId: string, tipo: TipoMediaTenant): string {
  return `${tenantId}/${tipo}`;
}

/** Colonna di `tenants` da aggiornare con l'URL pubblico, per ciascun tipo. */
export function colonnaUrlMedia(tipo: TipoMediaTenant): "logo_url" | "cover_url" {
  return tipo === "logo" ? "logo_url" : "cover_url";
}

/**
 * Restituisce un messaggio d'errore in italiano se il file non è valido,
 * altrimenti `null`. Controlla solo tipo/dimensione: il contenuto vero
 * dell'immagine non è mai ispezionato qui (nessuna libreria di image
 * processing in questo giro -- vedi DECISIONS.md per la scelta di scope).
 */
export function validaFileMedia(file: { type: string; size: number }): string | null {
  if (!file.type || !MIME_TYPE_CONSENTITI.includes(file.type as (typeof MIME_TYPE_CONSENTITI)[number])) {
    return "Formato non supportato: usa JPG, PNG o WebP.";
  }
  if (file.size <= 0) {
    return "Il file sembra vuoto.";
  }
  if (file.size > DIMENSIONE_MASSIMA_BYTES) {
    return "Il file supera i 4MB: comprimi l'immagine e riprova.";
  }
  return null;
}

/**
 * Aggiunge un parametro di cache-busting all'URL pubblico. Necessario
 * perché il percorso dell'oggetto è fisso (niente estensione/versione nel
 * nome): senza questo, un browser o una CDN che ha già visto quell'URL
 * continuerebbe a mostrare l'immagine vecchia dopo un nuovo caricamento,
 * perché l'URL salvato in `tenants.logo_url`/`cover_url` non cambierebbe
 * mai. `momento` è iniettabile per i test, di default `Date.now()`.
 */
export function urlMediaConCacheBuster(urlPubblico: string, momento: number = Date.now()): string {
  const separatore = urlPubblico.includes("?") ? "&" : "?";
  return `${urlPubblico}${separatore}v=${momento}`;
}
