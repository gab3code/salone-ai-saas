import "server-only";
import QRCode from "qrcode";

/**
 * Genera un QR code come data URL PNG, lato server (Fase 4 di PIANO.md,
 * richiesta di Gabriel 15/09/2026: "serve un modo per condividere il link
 * del proprio negozio sui siti come Google o su Instagram"). Generato in
 * Node (nessun `<canvas>` richiesto: `qrcode` in ambiente server usa una
 * codifica PNG pura via `pngjs`) invece che nel browser, per non aggiungere
 * la libreria al bundle client -- il componente client si limita a
 * mostrare l'immagine già pronta e a offrirne il download.
 *
 * `errorCorrectionLevel: "M"` (livello medio, non il minimo "L"): un QR
 * pensato per essere stampato su un volantino o mostrato in una storia
 * Instagram tollera meglio una foto leggermente sfocata o un angolo
 * coperto con un margine di correzione più alto, a fronte di un QR
 * leggermente più denso -- scelta ragionevole di default, non richiesta
 * esplicitamente da Gabriel.
 */
export async function generaQrCodeDataUrl(testo: string): Promise<string> {
  return QRCode.toDataURL(testo, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}
