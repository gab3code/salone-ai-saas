import { describe, expect, it } from "vitest";
import {
  istruzioniContatto,
  linkWhatsapp,
  normalizzaTelefonoVisibile,
  numeroPerWhatsapp,
  telefonoPlausibile,
} from "./contatti";

describe("numeroPerWhatsapp", () => {
  it("aggiunge il prefisso italiano a un numero scritto come lo scrive un italiano", () => {
    expect(numeroPerWhatsapp("333 123 4567")).toBe("393331234567");
    expect(numeroPerWhatsapp("3331234567")).toBe("393331234567");
  });

  it("rispetta un prefisso internazionale già scritto, in tutte e tre le forme", () => {
    expect(numeroPerWhatsapp("+39 333 1234567")).toBe("393331234567");
    expect(numeroPerWhatsapp("0039 333 1234567")).toBe("393331234567");
    expect(numeroPerWhatsapp("+41 79 1234567")).toBe("41791234567");
  });

  it("non scambia per prefisso un 39 che è l'inizio del numero", () => {
    // 393... è un cellulare italiano scritto senza prefisso: se togliessimo
    // il "39" iniziale credendolo un prefisso, il link aprirebbe una chat
    // con un numero che non esiste.
    expect(numeroPerWhatsapp("3931234567")).toBe("393931234567");
  });

  it("restituisce null su tutto ciò che non è un numero utilizzabile", () => {
    expect(numeroPerWhatsapp(null)).toBeNull();
    expect(numeroPerWhatsapp("")).toBeNull();
    expect(numeroPerWhatsapp("chiamaci!")).toBeNull();
    expect(numeroPerWhatsapp("12345")).toBeNull(); // troppo corto
  });
});

describe("linkWhatsapp", () => {
  it("costruisce il link solo quando il numero regge", () => {
    expect(linkWhatsapp("333 1234567")).toBe("https://wa.me/393331234567");
    expect(linkWhatsapp("non un numero")).toBeNull();
  });
});

describe("normalizzaTelefonoVisibile", () => {
  it("non riscrive il numero in un formato canonico: lo lascia come lo ha scritto il titolare", () => {
    expect(normalizzaTelefonoVisibile("  02 1234 5678 ")).toBe("02 1234 5678");
    expect(normalizzaTelefonoVisibile("+39 (02) 1234-5678")).toBe("+39 (02) 1234-5678");
  });

  it("toglie i caratteri che in un numero non ci stanno", () => {
    expect(normalizzaTelefonoVisibile("333<script>1234567")).toBe("3331234567");
  });
});

describe("telefonoPlausibile", () => {
  it("accetta largo, perché questo campo non alimenta nessun invio automatico", () => {
    expect(telefonoPlausibile("02 1234567")).toBe(true);
    expect(telefonoPlausibile("+39 333 123 4567")).toBe(true);
  });

  it("rifiuta quello che non può essere un numero", () => {
    expect(telefonoPlausibile("")).toBe(false);
    expect(telefonoPlausibile("12345")).toBe(false);
    expect(telefonoPlausibile("1".repeat(16))).toBe(false);
  });
});

describe("istruzioniContatto", () => {
  it("con lo stesso numero su entrambi i canali non lo ripete due volte", () => {
    // "chiama il 333... o scrivi su WhatsApp al 333..." con lo stesso numero
    // ripetuto fa sembrare l'assistente rotto.
    expect(
      istruzioniContatto({ telefono: "333 1234567", telefonoWhatsapp: "+39 3331234567" })
    ).toBe("chiamare o scrivere su WhatsApp al 333 1234567");
  });

  it("con due numeri diversi li nomina entrambi", () => {
    expect(istruzioniContatto({ telefono: "02 1234567", telefonoWhatsapp: "333 7654321" })).toBe(
      "chiamare il 02 1234567 oppure scrivere su WhatsApp al 333 7654321"
    );
  });

  it("con un canale solo nomina quello", () => {
    expect(istruzioniContatto({ telefono: "02 1234567", telefonoWhatsapp: null })).toBe(
      "chiamare il 02 1234567"
    );
    expect(istruzioniContatto({ telefono: null, telefonoWhatsapp: "333 7654321" })).toBe(
      "scrivere su WhatsApp al 333 7654321"
    );
  });

  it("senza nessun recapito non inventa niente", () => {
    expect(istruzioniContatto({ telefono: null, telefonoWhatsapp: null })).toBeNull();
    expect(istruzioniContatto({ telefono: "  ", telefonoWhatsapp: "" })).toBeNull();
  });
});
