/**
 * La foto dell'agenda, preparata NEL BROWSER prima di partire.
 *
 * Due ragioni per ridurla qui e non sul server:
 *  - il modello usa al massimo 1568 px sul lato lungo: una foto da 12
 *    megapixel viaggerebbe per niente, e il corpo di una server action ha
 *    un tetto (4 MB, next.config.ts);
 *  - passando dal canvas la foto esce sempre come JPEG, qualunque fosse il
 *    formato d'origine che il browser sa aprire. Un HEIC dell'iPhone su
 *    Chrome non si apre: in quel caso si dice cosa fare, non si prova a
 *    indovinare.
 */

export const LATO_MASSIMO_FOTO = 1568;

export interface FotoPronta {
  /** data URL per l'anteprima. */
  anteprima: string;
  /** Solo la parte base64, senza il prefisso data:. */
  base64: string;
  tipo: "image/jpeg";
  nome: string;
}

export async function preparaFotoPerImport(file: File): Promise<{ ok: true; foto: FotoPronta } | { ok: false; errore: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      ok: false,
      errore:
        "Non riesco ad aprire questa immagine. Se è un file HEIC dell'iPhone, esportala come JPEG o fai uno screenshot della pagina.",
    };
  }
  const scala = Math.min(1, LATO_MASSIMO_FOTO / Math.max(bitmap.width, bitmap.height));
  const larghezza = Math.max(1, Math.round(bitmap.width * scala));
  const altezza = Math.max(1, Math.round(bitmap.height * scala));
  const canvas = document.createElement("canvas");
  canvas.width = larghezza;
  canvas.height = altezza;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, errore: "Il browser non riesce a preparare la foto." };
  ctx.drawImage(bitmap, 0, 0, larghezza, altezza);
  bitmap.close();
  const anteprima = canvas.toDataURL("image/jpeg", 0.85);
  const virgola = anteprima.indexOf(",");
  if (virgola === -1) return { ok: false, errore: "Il browser non riesce a preparare la foto." };
  return {
    ok: true,
    foto: { anteprima, base64: anteprima.slice(virgola + 1), tipo: "image/jpeg", nome: file.name },
  };
}
