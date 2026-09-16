import { describe, expect, it } from "vitest";
import {
  colonnaUrlMedia,
  DIMENSIONE_MASSIMA_BYTES,
  etichettaTipoMedia,
  percorsoOggettoMedia,
  urlMediaConCacheBuster,
  validaFileMedia,
} from "./media-tenant";

describe("percorsoOggettoMedia", () => {
  it("costruisce il percorso senza estensione", () => {
    expect(percorsoOggettoMedia("tenant-1", "logo")).toBe("tenant-1/logo");
    expect(percorsoOggettoMedia("tenant-1", "cover")).toBe("tenant-1/cover");
  });
});

describe("colonnaUrlMedia", () => {
  it("mappa il tipo alla colonna giusta", () => {
    expect(colonnaUrlMedia("logo")).toBe("logo_url");
    expect(colonnaUrlMedia("cover")).toBe("cover_url");
  });
});

describe("etichettaTipoMedia", () => {
  it("restituisce un'etichetta leggibile per ogni tipo", () => {
    expect(etichettaTipoMedia("logo")).toBe("Logo");
    expect(etichettaTipoMedia("cover")).toBe("Foto di copertina");
  });
});

describe("validaFileMedia", () => {
  it("accetta jpg/png/webp entro il limite di dimensione", () => {
    expect(validaFileMedia({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validaFileMedia({ type: "image/png", size: 1024 })).toBeNull();
    expect(validaFileMedia({ type: "image/webp", size: DIMENSIONE_MASSIMA_BYTES })).toBeNull();
  });

  it("rifiuta un formato non supportato", () => {
    expect(validaFileMedia({ type: "image/gif", size: 1024 })).toMatch(/formato non supportato/i);
    expect(validaFileMedia({ type: "application/pdf", size: 1024 })).toMatch(/formato non supportato/i);
    expect(validaFileMedia({ type: "", size: 1024 })).toMatch(/formato non supportato/i);
  });

  it("rifiuta un file vuoto", () => {
    expect(validaFileMedia({ type: "image/png", size: 0 })).toMatch(/vuoto/i);
  });

  it("rifiuta un file troppo grande", () => {
    expect(validaFileMedia({ type: "image/png", size: DIMENSIONE_MASSIMA_BYTES + 1 })).toMatch(/supera i 4mb/i);
  });
});

describe("urlMediaConCacheBuster", () => {
  it("aggiunge il parametro v su un URL senza query string", () => {
    expect(urlMediaConCacheBuster("https://x.supabase.co/storage/v1/object/public/media-tenant/t1/logo", 123)).toBe(
      "https://x.supabase.co/storage/v1/object/public/media-tenant/t1/logo?v=123"
    );
  });

  it("aggiunge il parametro v con & se l'URL ha gia' una query string", () => {
    expect(urlMediaConCacheBuster("https://x.supabase.co/logo?foo=bar", 456)).toBe(
      "https://x.supabase.co/logo?foo=bar&v=456"
    );
  });

  it("cambia valore da una chiamata all'altra, cosi' l'URL salvato non e' mai lo stesso dopo un nuovo upload", () => {
    const primo = urlMediaConCacheBuster("https://x.supabase.co/logo", 1);
    const secondo = urlMediaConCacheBuster("https://x.supabase.co/logo", 2);
    expect(primo).not.toBe(secondo);
  });
});
