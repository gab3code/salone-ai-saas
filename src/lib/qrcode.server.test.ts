import { describe, expect, it } from "vitest";
import { generaQrCodeDataUrl } from "./qrcode.server";

describe("generaQrCodeDataUrl", () => {
  it("genera un data URL PNG valido per un URL pubblico di un tenant", async () => {
    const dataUrl = await generaQrCodeDataUrl("https://salone-ai-saas.vercel.app/s/salone-bc163ecf");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // Un QR a 320px con correzione errori "M" per un URL di questa lunghezza
    // produce sempre un payload di una certa dimensione minima -- una
    // stringa sospettosamente corta indicherebbe un QR vuoto/rotto.
    expect(dataUrl.length).toBeGreaterThan(500);
  });

  it("testi diversi producono QR (quindi data URL) diversi", async () => {
    const a = await generaQrCodeDataUrl("https://esempio.it/s/tenant-a");
    const b = await generaQrCodeDataUrl("https://esempio.it/s/tenant-b");
    expect(a).not.toEqual(b);
  });
});
