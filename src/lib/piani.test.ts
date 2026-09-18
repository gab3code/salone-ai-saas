import { describe, expect, it } from "vitest";
import { limiteMembri, limiteMensilePrenotazioni, limiteMensileSms, limiteOperatori, pianoHaAnalytics, pianoHaKnowledgeBaseAi, pianoHaListaAttesaAutomatica, pianoHaSms, pianoHaTeam, prezzoMensileCentesimi } from "./piani";

describe("limiteMensilePrenotazioni", () => {
  it("il piano free ha un tetto di 60 prenotazioni al mese", () => {
    expect(limiteMensilePrenotazioni("free")).toBe(60);
  });

  it("tutti gli altri piani restano illimitati su questo fronte (leva di prodotto, non di costo)", () => {
    for (const piano of ["starter", "growth", "pro", "enterprise"]) {
      expect(limiteMensilePrenotazioni(piano)).toBe(Infinity);
    }
  });

  it("un piano sconosciuto/malformato non ha un tetto -- fail-open qui, mai bloccare una prenotazione reale per un valore di piano imprevisto", () => {
    expect(limiteMensilePrenotazioni("qualcosa-di-strano")).toBe(Infinity);
  });
});

describe("limiteOperatori", () => {
  it("il piano free è limitato a 1 operatore, come pubblicizzato in Prezzi.tsx", () => {
    expect(limiteOperatori("free")).toBe(1);
  });

  it("tutti gli altri piani restano illimitati", () => {
    for (const piano of ["starter", "growth", "pro", "enterprise"]) {
      expect(limiteOperatori(piano)).toBe(Infinity);
    }
  });

  it("un piano sconosciuto/malformato non ha un tetto -- fail-open, mai bloccare la creazione di un operatore per un valore imprevisto", () => {
    expect(limiteOperatori("qualcosa-di-strano")).toBe(Infinity);
  });
});

describe("pianoHaAnalytics", () => {
  it("growth, pro ed enterprise hanno accesso, come pubblicizzato in Prezzi.tsx/Funzionalita.tsx", () => {
    for (const piano of ["growth", "pro", "enterprise"]) {
      expect(pianoHaAnalytics(piano)).toBe(true);
    }
  });

  it("free e starter non hanno accesso", () => {
    for (const piano of ["free", "starter"]) {
      expect(pianoHaAnalytics(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed qui: diverso dai limiti sopra, dare accesso a una funzione a pagamento per un valore imprevisto sarebbe il difetto pericoloso, non il contrario", () => {
    expect(pianoHaAnalytics("qualcosa-di-strano")).toBe(false);
  });
});

describe("pianoHaListaAttesaAutomatica", () => {
  it("growth, pro ed enterprise hanno accesso al contatto automatico della lista d'attesa", () => {
    for (const piano of ["growth", "pro", "enterprise"]) {
      expect(pianoHaListaAttesaAutomatica(piano)).toBe(true);
    }
  });

  it("il free non ha accesso, lo starter si' (sceso il 18/09/2026)", () => {
    // Starter vendeva solo la rimozione di due limiti del Free. Promemoria e
    // contatto automatico sono scesi li' per dargli una promessa vera
    // ("meno buchi in agenda") senza toccare l'assistente, che resta la
    // ragione per passare a Growth.
    expect(pianoHaListaAttesaAutomatica("free")).toBe(false);
    expect(pianoHaListaAttesaAutomatica("starter")).toBe(true);
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed, stesso principio di pianoHaAnalytics", () => {
    expect(pianoHaListaAttesaAutomatica("qualcosa-di-strano")).toBe(false);
  });
});

describe("pianoHaSms", () => {
  it("pro ed enterprise hanno accesso, come pubblicizzato in Prezzi.tsx", () => {
    for (const piano of ["pro", "enterprise"]) {
      expect(pianoHaSms(piano)).toBe(true);
    }
  });

  it("free, starter e growth non hanno accesso -- l'SMS costa soldi veri, non è incluso nemmeno nei piani con Promemoria/AI", () => {
    for (const piano of ["free", "starter", "growth"]) {
      expect(pianoHaSms(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed, stesso principio di pianoHaAnalytics", () => {
    expect(pianoHaSms("qualcosa-di-strano")).toBe(false);
  });
});

describe("limiteMensileSms", () => {
  it("un piano senza SMS ha sempre tetto zero, a prescindere dal numero di operatori", () => {
    expect(limiteMensileSms("growth", 5)).toBe(0);
  });

  it("pro con 1 operatore (o zero, es. onboarding non ancora completato) ha 100 SMS/mese", () => {
    expect(limiteMensileSms("pro", 1)).toBe(100);
    expect(limiteMensileSms("pro", 0)).toBe(100);
  });

  it("pro con più operatori scala linearmente: 100 SMS/operatore/mese", () => {
    expect(limiteMensileSms("pro", 3)).toBe(300);
  });
});

describe("pianoHaKnowledgeBaseAi", () => {
  it("pro ed enterprise hanno accesso alla knowledge base dell'AI receptionist", () => {
    for (const piano of ["pro", "enterprise"]) {
      expect(pianoHaKnowledgeBaseAi(piano)).toBe(true);
    }
  });

  it("free, starter e growth non hanno accesso -- un tenant Growth mantiene la chat AI transazionale ma non la capacità informativa", () => {
    for (const piano of ["free", "starter", "growth"]) {
      expect(pianoHaKnowledgeBaseAi(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed, stesso principio di pianoHaAnalytics", () => {
    expect(pianoHaKnowledgeBaseAi("qualcosa-di-strano")).toBe(false);
  });
});

describe("limiteMembri / pianoHaTeam (Fase 5, deciso con Gabriel il 16/09/2026)", () => {
  it("ogni piano a pagamento può dare accessi al personale", () => {
    // Il personale è già monetizzato dalla quota per operatore (10/15/20€,
    // vedi priceIdOperatoreExtra in stripe/piani.ts): mettere ANCHE un tetto
    // agli accessi vorrebbe dire far pagare due volte la stessa cosa.
    for (const piano of ["starter", "growth", "pro", "enterprise"]) {
      expect(limiteMembri(piano)).toBe(Infinity);
      expect(pianoHaTeam(piano)).toBe(true);
    }
  });

  it("Free resta a un solo accesso -- è già un piano da una persona sola", () => {
    expect(limiteMembri("free")).toBe(1);
    expect(pianoHaTeam("free")).toBe(false);
  });

  it("un piano sconosciuto NON viene limitato -- fail-open, al contrario dei gate di funzione", () => {
    // Scelta deliberata e opposta a pianoHaAnalytics/pianoHaSms: qui un piano
    // illeggibile non deve impedire a un titolare legittimo di invitare un
    // collaboratore che sta già lavorando. Stesso principio di
    // `limiteOperatori`, che per un piano sconosciuto restituisce Infinity.
    expect(limiteMembri("qualcosa-di-strano")).toBe(Infinity);
    expect(limiteOperatori("qualcosa-di-strano")).toBe(Infinity);
  });

  it("un membro non è un operatore: su Starter gli operatori sono illimitati come record, ma ognuno oltre il primo si paga", () => {
    // Confusione facile e costosa da chiarire una volta sola: "operatore" è un
    // record dell'agenda (nessun tetto da Starter in su), "membro" è un
    // account che entra in dashboard. Quello che scala col personale è il
    // PREZZO, non un limite.
    expect(limiteOperatori("starter")).toBe(Infinity);
    expect(limiteMembri("starter")).toBe(Infinity);
    expect(limiteOperatori("free")).toBe(1);
  });
});

describe("prezzoMensileCentesimi", () => {
  /**
   * È la cifra che un salone legge PRIMA di scegliere un piano, quindi deve
   * coincidere con quella che Stripe gli addebiterà. Il caso che conta è il
   * confronto fra piani: la quota per operatore cambia con il piano, e chi ha
   * più persone non vede la differenza che si aspetta.
   */
  it("somma la quota di ogni operatore oltre il primo, con la tariffa del piano", () => {
    expect(prezzoMensileCentesimi("starter", 1)).toBe(1990);
    expect(prezzoMensileCentesimi("starter", 3)).toBe(1990 + 1000 * 2);
    expect(prezzoMensileCentesimi("growth", 3)).toBe(3990 + 1500 * 2);
    expect(prezzoMensileCentesimi("pro", 3)).toBe(8990 + 2000 * 2);
  });

  it("con tre operatori il salto da Starter a Growth è 39,90 -> 69,90, non 19,90 -> 39,90", () => {
    // È esattamente il motivo per cui la pagina mostra il prezzo vero e non
    // quello base: la differenza percepita raddoppia.
    expect(prezzoMensileCentesimi("starter", 3)).toBe(3990);
    expect(prezzoMensileCentesimi("growth", 3)).toBe(6990);
  });

  it("zero operatori non va sotto il prezzo base", () => {
    expect(prezzoMensileCentesimi("growth", 0)).toBe(3990);
  });

  it("free costa zero e un piano sconosciuto non inventa un prezzo", () => {
    expect(prezzoMensileCentesimi("free", 5)).toBe(0);
    expect(prezzoMensileCentesimi("enterprise", 5)).toBe(0);
  });
});
