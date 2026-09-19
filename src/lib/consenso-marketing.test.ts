import { describe, expect, it } from "vitest";
import { campiConsenso } from "./consenso-marketing";

describe("campiConsenso -- come si scrive la risposta del cliente", () => {
  it("undefined = non chiesto in questo passaggio: non si tocca niente", () => {
    expect(campiConsenso(undefined, "prenotazione_online")).toEqual({});
  });

  it("si' e no si scrivono entrambi, con data e provenienza: una revoca vale quanto un consenso", () => {
    const si = campiConsenso(true, "prenotazione_online");
    expect(si.consenso_marketing).toBe(true);
    expect(si.consenso_marketing_fonte).toBe("prenotazione_online");
    expect(typeof si.consenso_marketing_at).toBe("string");
    const no = campiConsenso(false, "scheda");
    expect(no.consenso_marketing).toBe(false);
    expect(no.consenso_marketing_fonte).toBe("scheda");
  });
});
