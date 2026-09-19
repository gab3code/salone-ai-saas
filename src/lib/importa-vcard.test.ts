import { describe, expect, it } from "vitest";
import { eVCard, leggiTestoImport, leggiVCard } from "./importa-vcard";

const IPHONE = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Rossi;Maria;;;",
  "FN:Maria Rossi",
  "item1.TEL;type=CELL;type=VOICE;type=pref:+39 333 123 4567",
  "item2.TEL;type=HOME;type=VOICE:02 1234567",
  "EMAIL;type=INTERNET;type=HOME;type=pref:maria@esempio.it",
  "NOTE:Colore ogni 5 settimane\\, preferisce il martedi'",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Bianchi;Luca;;;",
  "FN:Luca Bianchi",
  "TEL;type=CELL:3339876543",
  "END:VCARD",
].join("\r\n");

describe("riconoscere una vCard", () => {
  it("un file .vcf comincia con BEGIN:VCARD", () => {
    expect(eVCard(IPHONE)).toBe(true);
    expect(eVCard("Nome;Telefono\nMaria;333")).toBe(false);
  });

  it("leggiTestoImport manda la vCard al lettore giusto e il CSV a leggiIncolla", () => {
    expect(leggiTestoImport(IPHONE).clienti).toHaveLength(2);
    expect(leggiTestoImport("Nome;Telefono\nMaria;3331234567").clienti[0]).toMatchObject({ nome: "Maria" });
  });
});

describe("leggere un export dell'iPhone (vCard 3.0)", () => {
  it("nome da FN, il cellulare vince sul fisso, l'altro numero resta nelle note, la nota si legge", () => {
    const esito = leggiVCard(IPHONE);
    expect(esito.clienti).toEqual([
      {
        nome: "Maria Rossi",
        telefono: "+39 333 123 4567",
        email: "maria@esempio.it",
        note: "Colore ogni 5 settimane, preferisce il martedi' · Altro numero: 02 1234567",
      },
      { nome: "Luca Bianchi", telefono: "3339876543", email: null, note: null },
    ]);
    expect(esito.scartate).toEqual([]);
  });

  it("una scheda senza numero non sparisce: si vede fra le scartate, col nome", () => {
    const esito = leggiVCard(["BEGIN:VCARD", "FN:Fornitore Tinte", "EMAIL:ordini@tinte.it", "END:VCARD"].join("\n"));
    expect(esito.clienti).toEqual([]);
    expect(esito.scartate).toEqual(["Fornitore Tinte: nessun numero nella scheda"]);
  });

  it("senza FN il nome si ricompone da N (Nome Cognome), senza N da ORG", () => {
    const daN = leggiVCard(["BEGIN:VCARD", "N:Verdi;Anna;Maria;;", "TEL:3331112222", "END:VCARD"].join("\n"));
    expect(daN.clienti[0].nome).toBe("Anna Maria Verdi");
    const daOrg = leggiVCard(["BEGIN:VCARD", "ORG:Parrucchieri Uniti;", "TEL:3331112223", "END:VCARD"].join("\n"));
    expect(daOrg.clienti[0].nome).toBe("Parrucchieri Uniti");
  });

  it("una riga lunga spezzata su due (folding) si rimette insieme: il primo spazio della continuazione e' il segno, il resto e' testo", () => {
    const esito = leggiVCard(
      ["BEGIN:VCARD", "FN:Maria Rossi", "TEL:3331234567", "NOTE:prima parte della nota che continua", "  sulla riga dopo", "END:VCARD"].join("\r\n")
    );
    expect(esito.clienti[0].note).toBe("prima parte della nota che continua sulla riga dopo");
  });

  it("lo stesso numero in due schede si tiene una volta sola", () => {
    const esito = leggiVCard(
      ["BEGIN:VCARD", "FN:Maria", "TEL:3331234567", "END:VCARD", "BEGIN:VCARD", "FN:Maria Rossi", "TEL:+39 333 123 4567", "END:VCARD"].join("\n")
    );
    expect(esito.clienti).toHaveLength(1);
  });
});

describe("leggere un export Android vecchio (vCard 2.1, quoted-printable)", () => {
  it("decodifica gli accenti e la continuazione con '=' a fine riga", () => {
    const esito = leggiVCard(
      [
        "BEGIN:VCARD",
        "VERSION:2.1",
        "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Nicol=C3=B2;Andr=C3=A9;;;",
        "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Andr=C3=A9 Nic=",
        "ol=C3=B2",
        "TEL;CELL:333 123 4567",
        "END:VCARD",
      ].join("\r\n")
    );
    expect(esito.clienti[0]).toMatchObject({ nome: "André Nicolò", telefono: "333 123 4567" });
  });

  it("TEL come URI (tel:+39...) si legge lo stesso", () => {
    const esito = leggiVCard(["BEGIN:VCARD", "VERSION:4.0", "FN:Maria", "TEL;VALUE=uri;TYPE=cell:tel:+39-333-123-4567", "END:VCARD"].join("\n"));
    expect(esito.clienti[0].telefono).toBe("+39-333-123-4567");
  });

  it("un testo vuoto o senza schede non lancia", () => {
    expect(leggiVCard("")).toEqual({ clienti: [], scartate: [] });
    expect(leggiVCard("BEGIN:VCARD\nFN:Maria")).toEqual({ clienti: [], scartate: [] });
  });
});
