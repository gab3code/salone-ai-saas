import { describe, expect, it } from "vitest";
import {
  haQualcosaDaCompletare,
  campiDaCompletare,
  calcolaDiffImport,
  dividiRiga,
  estraiTelefonoDaCampo,
  leggiIncolla,
  stessoTelefono,
  telefonoCanonico,
  telefonoUtilizzabile,
  MAX_RIGHE_IMPORT,
} from "./importa-clienti";

describe("il telefono come chiave", () => {
  it("LO STESSO NUMERO SCRITTO IN QUATTRO MODI E' LO STESSO CLIENTE", () => {
    // E' il difetto che renderebbe inutile tutto l'import: oggi il database
    // confronta le stringhe cosi' come sono, e su trecento righe il salone
    // si ritroverebbe la rubrica doppia.
    const forme = ["333 123 4567", "+39 333 1234567", "0039 333 1234567", "3331234567"];
    for (const forma of forme) expect(telefonoCanonico(forma)).toBe("3331234567");
    for (const forma of forme) expect(stessoTelefono(forma, "333-123-4567")).toBe(true);
  });

  it("un fisso con lo zero iniziale resta com'e'", () => {
    expect(telefonoCanonico("02 1234 5678")).toBe("0212345678");
  });

  it("un numero che comincia per 39 di suo non viene mutilato", () => {
    // 3912345 senza prefisso: togliendo il "39" resterebbero 5 cifre, che
    // non e' un numero italiano plausibile. Meglio lasciarlo intero.
    expect(telefonoCanonico("3912345")).toBe("3912345");
  });

  it("due numeri diversi restano diversi, e il vuoto non combacia con niente", () => {
    expect(stessoTelefono("3331234567", "3337654321")).toBe(false);
    expect(stessoTelefono("", "")).toBe(false);
    expect(stessoTelefono(null, null)).toBe(false);
  });

  it("utilizzabile e' permissivo come il resto del progetto", () => {
    expect(telefonoUtilizzabile("333 123 4567")).toBe(true);
    expect(telefonoUtilizzabile("12345")).toBe(false);
    expect(telefonoUtilizzabile("Rossi Maria")).toBe(false);
  });
});

describe("come si taglia una riga", () => {
  it("riconosce tabulazione, punto e virgola e virgola", () => {
    expect(dividiRiga("Maria\t333123\tx")).toEqual(["Maria", "333123", "x"]);
    expect(dividiRiga("Maria;333123;x")).toEqual(["Maria", "333123", "x"]);
    expect(dividiRiga("Maria,333123,x")).toEqual(["Maria", "333123", "x"]);
  });

  it("le virgolette tengono insieme un campo con la virgola dentro", () => {
    expect(dividiRiga('"Rossi, Maria",3331234567')).toEqual(["Rossi, Maria", "3331234567"]);
  });
});

describe("leggere un incolla senza modello", () => {
  it("un CSV con intestazione italiana", () => {
    const esito = leggiIncolla(
      ["Nome;Telefono;Email", "Maria Rossi;333 123 4567;maria@esempio.it", "Luca Bianchi;3339876543;"].join("\n")
    );
    expect(esito.clienti).toEqual([
      { nome: "Maria Rossi", telefono: "333 123 4567", email: "maria@esempio.it", note: null },
      { nome: "Luca Bianchi", telefono: "3339876543", email: null, note: null },
    ]);
  });

  it("un incolla da Excel, separato da tabulazioni e in inglese", () => {
    const esito = leggiIncolla(["Name\tPhone", "Maria Rossi\t3331234567"].join("\n"));
    expect(esito.clienti[0]).toMatchObject({ nome: "Maria Rossi", telefono: "3331234567" });
  });

  it("una lista scritta a mano, senza intestazione", () => {
    const esito = leggiIncolla(["Maria Rossi, 333 123 4567", "Luca, 333 987 6543"].join("\n"));
    expect(esito.clienti).toHaveLength(2);
    expect(esito.clienti[0]).toMatchObject({ nome: "Maria Rossi", telefono: "333 123 4567" });
  });

  it("LE RIGHE SENZA NUMERO NON SPARISCONO: si vedono in revisione", () => {
    // "180 su 200" e' un numero che non si puo' controllare se non si vede
    // quali venti sono rimaste fuori.
    const esito = leggiIncolla(["Nome;Telefono", "Maria;3331234567", "Appunto: richiamare i clienti vecchi"].join("\n"));
    expect(esito.clienti).toHaveLength(1);
    expect(esito.scartate).toEqual(["Appunto: richiamare i clienti vecchi"]);
  });

  it("un doppione dentro lo stesso incolla si tiene una volta sola", () => {
    const esito = leggiIncolla(
      ["Nome;Telefono", "Maria;333 123 4567", "Maria Rossi;+393331234567"].join("\n")
    );
    expect(esito.clienti).toHaveLength(1);
    expect(esito.clienti[0].nome).toBe("Maria");
  });

  it("non legge all'infinito: si ferma al tetto", () => {
    const righe = ["Nome;Telefono"];
    for (let i = 0; i < MAX_RIGHE_IMPORT + 50; i++) righe.push(`Cliente ${i};333${String(i).padStart(7, "0")}`);
    expect(leggiIncolla(righe.join("\n")).clienti).toHaveLength(MAX_RIGHE_IMPORT);
  });

  it("un incolla vuoto o illeggibile non lancia mai", () => {
    for (const strano of ["", "   ", "\n\n\n"]) {
      expect(() => leggiIncolla(strano)).not.toThrow();
      expect(leggiIncolla(strano).clienti).toEqual([]);
    }
  });
});

describe("il confronto con chi c'e' gia'", () => {
  const esistenti = [
    { id: "cli-1", nome: "Maria R.", telefono: "+39 333 123 4567", email: null },
    { id: "cli-2", nome: "Luca", telefono: "3339876543", email: null },
  ];

  it("CHI C'E' GIA' NON DIVENTA UN DOPPIONE, anche se il numero e' scritto diverso", () => {
    const diff = calcolaDiffImport(esistenti, leggiIncolla("Nome;Telefono\nMaria Rossi;3331234567"));
    expect(diff.nuovi).toHaveLength(0);
    expect(diff.giaPresenti).toHaveLength(1);
    expect(diff.giaPresenti[0].esistenteId).toBe("cli-1");
    // Serve a mostrare in revisione cosa cambierebbe: "Maria R." -> "Maria Rossi".
    expect(diff.giaPresenti[0].nomeEsistente).toBe("Maria R.");
  });

  it("chi non c'e' e' nuovo", () => {
    const diff = calcolaDiffImport(esistenti, leggiIncolla("Nome;Telefono\nGiulia;3335550000"));
    expect(diff.nuovi).toHaveLength(1);
    expect(diff.nuovi[0].esistenteId).toBeNull();
  });

  it("le righe scartate arrivano fino in fondo", () => {
    const diff = calcolaDiffImport(esistenti, leggiIncolla("Nome;Telefono\nGiulia;3335550000\nnote a caso"));
    expect(diff.scartate).toEqual(["note a caso"]);
  });

  it("un cliente esistente SENZA numero non fa combaciare niente", () => {
    // In rubrica esistono schede senza telefono (create a mano). Senza questa
    // regola diventerebbero la calamita a cui si attaccano tutte le righe
    // importate che non hanno un numero riconoscibile.
    const diff = calcolaDiffImport(
      [{ id: "cli-3", nome: "Senza numero", telefono: null, email: null }],
      leggiIncolla("Nome;Telefono\nGiulia;3335550000")
    );
    expect(diff.nuovi).toHaveLength(1);
    expect(diff.giaPresenti).toHaveLength(0);
  });

  it("una rubrica vuota rende tutto nuovo", () => {
    const diff = calcolaDiffImport([], leggiIncolla("Nome;Telefono\nGiulia;3335550000"));
    expect(diff.nuovi).toHaveLength(1);
    expect(diff.giaPresenti).toHaveLength(0);
  });
});

describe("completare chi c'e' gia' (19/09/2026, la meta' mancante dell'import)", () => {
  it("propone di riempire SOLO i campi vuoti nel prodotto e pieni nel file", () => {
    const diff = calcolaDiffImport(
      [{ id: "cli-1", nome: null, telefono: "3331234567", email: null }],
      leggiIncolla("Nome;Telefono;Email\nMaria Rossi;3331234567;maria@esempio.it")
    );
    const riga = diff.giaPresenti[0];
    expect(riga.completabile).toEqual({ nome: true, email: true });
    expect(haQualcosaDaCompletare(riga)).toBe(true);
    expect(campiDaCompletare(riga)).toEqual({ nome: "Maria Rossi", email: "maria@esempio.it" });
  });

  it("NON propone di sovrascrivere un nome che nel prodotto c'e' gia', anche se diverso", () => {
    const diff = calcolaDiffImport(
      [{ id: "cli-1", nome: "Maria R.", telefono: "3331234567", email: "vecchia@esempio.it" }],
      leggiIncolla("Nome;Telefono;Email\nMaria Rossi;3331234567;nuova@esempio.it")
    );
    const riga = diff.giaPresenti[0];
    expect(riga.completabile).toEqual({ nome: false, email: false });
    expect(haQualcosaDaCompletare(riga)).toBe(false);
    expect(campiDaCompletare(riga)).toEqual({});
  });

  it("un file senza email non propone niente sull'email, anche se nel prodotto manca", () => {
    const diff = calcolaDiffImport(
      [{ id: "cli-1", nome: null, telefono: "3331234567", email: null }],
      leggiIncolla("Nome;Telefono\nMaria Rossi;3331234567")
    );
    expect(diff.giaPresenti[0].completabile).toEqual({ nome: true, email: false });
  });

  it("un cliente nuovo non ha niente da completare (non esiste ancora)", () => {
    const diff = calcolaDiffImport([], leggiIncolla("Nome;Telefono\nGiulia;3335550000"));
    expect(diff.nuovi[0].completabile).toEqual({ nome: false, email: false });
  });
});

describe("un campo che contiene un numero non e' un numero (19/09/2026, primo incolla vero di Gabriel)", () => {
  it("la riga sporca dello screenshot non diventa un cliente senza nome: va fra le non capite", () => {
    expect(estraiTelefonoDaCampo("Maria la bionda del martedi' 333 123 4568")).toBeNull();
    const esito = leggiIncolla("Maria la bionda del martedi' 333 123 4568");
    expect(esito.clienti).toEqual([]);
    expect(esito.scartate).toEqual(["Maria la bionda del martedi' 333 123 4568"]);
  });

  it("nome e numero nello stesso campo: il resto e' il nome", () => {
    expect(estraiTelefonoDaCampo("Maria Rossi 333 1234567")).toEqual({ telefono: "333 1234567", resto: "Maria Rossi" });
    expect(leggiIncolla("Maria Rossi 333 1234567").clienti[0]).toMatchObject({ nome: "Maria Rossi", telefono: "333 1234567" });
  });

  it("solo il numero: resto vuoto", () => {
    expect(estraiTelefonoDaCampo(" +39 333 123 4567 ")).toEqual({ telefono: "+39 333 123 4567", resto: "" });
  });

  it("fra piu' sequenze di cifre vince quella con piu' cifre", () => {
    expect(estraiTelefonoDaCampo("Maria 12 Rossi 333 1234567")).toEqual({ telefono: "333 1234567", resto: "Maria 12 Rossi" });
  });

  it("senza un numero utilizzabile non c'e' niente da estrarre", () => {
    expect(estraiTelefonoDaCampo("Maria Rossi")).toBeNull();
    expect(estraiTelefonoDaCampo("interno 12")).toBeNull();
  });
});
