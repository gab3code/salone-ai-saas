/**
 * Quale database usano i test, e la guardia che impedisce di usare quello vero.
 *
 * Fino al 18/09/2026 la suite E2E creava tenant, clienti e appuntamenti VERI
 * nel database di PRODUZIONE, e ne faceva partire webhook Stripe veri. Con
 * zero clienti e' solo sporcizia; dal primo cliente pagante e' un incidente
 * che aspetta di succedere -- e il momento per separarli e' adesso, finche'
 * non c'e' niente da perdere.
 *
 * La regola qui e' fail-closed: senza una configurazione esplicita i test NON
 * partono. Un avviso si ignora, un blocco no, e questo e' il genere di errore
 * che non si vuole scoprire dopo.
 */

export interface DatabaseDiProva {
  url: string;
  chiaveServizio: string;
  chiaveAnonima: string;
  /** true quando si sta deliberatamente usando il database di produzione. */
  eProduzione: boolean;
}

export type EsitoDatabaseDiProva =
  | { ok: true; database: DatabaseDiProva }
  | { ok: false; errore: string };

const ISTRUZIONI = `
Come sistemarlo, in un modo o nell'altro:

  1) Consigliato -- un database separato. Crea (o risveglia) un secondo
     progetto Supabase, applicaci le migrazioni, e metti in .env.test:

       E2E_SUPABASE_URL=https://<progetto-di-prova>.supabase.co
       E2E_SUPABASE_ANON_KEY=...
       E2E_SUPABASE_SERVICE_ROLE_KEY=...

  2) Solo per un giro al volo -- usare comunque il database vero, sapendo
     cosa si sta facendo:

       E2E_CONSENTI_PRODUZIONE=1 npx playwright test

     Da riga di comando e non nel file .env, cosi' resta una decisione presa
     ogni volta invece di una che si dimentica accesa.
`.trim();

export function risolviDatabaseDiProva(
  env: Record<string, string | undefined>
): EsitoDatabaseDiProva {
  const url = env.E2E_SUPABASE_URL?.trim();
  const chiaveServizio = env.E2E_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const chiaveAnonima = env.E2E_SUPABASE_ANON_KEY?.trim();
  const produzione = env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (url || chiaveServizio || chiaveAnonima) {
    // Configurazione a meta': meglio fermarsi che indovinare quale pezzo
    // valga, perche' indovinare male significa scrivere in produzione.
    if (!url || !chiaveServizio || !chiaveAnonima) {
      return {
        ok: false,
        errore:
          "Il database di prova e' configurato a meta': servono tutte e tre E2E_SUPABASE_URL, " +
          "E2E_SUPABASE_ANON_KEY e E2E_SUPABASE_SERVICE_ROLE_KEY.\n\n" +
          ISTRUZIONI,
      };
    }

    if (produzione && normalizza(url) === normalizza(produzione)) {
      return {
        ok: false,
        errore:
          "E2E_SUPABASE_URL punta allo STESSO progetto di NEXT_PUBLIC_SUPABASE_URL: " +
          "il database di prova non e' separato da niente.\n\n" +
          ISTRUZIONI,
      };
    }

    return { ok: true, database: { url, chiaveServizio, chiaveAnonima, eProduzione: false } };
  }

  if (env.E2E_CONSENTI_PRODUZIONE === "1") {
    const chiaveProd = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const anonProd = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!produzione || !chiaveProd || !anonProd) {
      return {
        ok: false,
        errore:
          "E2E_CONSENTI_PRODUZIONE=1, ma mancano le variabili Supabase di produzione in .env.local.",
      };
    }
    return {
      ok: true,
      database: {
        url: produzione,
        chiaveServizio: chiaveProd,
        chiaveAnonima: anonProd,
        eProduzione: true,
      },
    };
  }

  return {
    ok: false,
    errore:
      "I test E2E non hanno un database su cui girare, e NON parto usando quello di produzione " +
      "senza che tu me lo dica: creano tenant, clienti e appuntamenti veri, e fanno partire " +
      "webhook Stripe veri.\n\n" +
      ISTRUZIONI,
  };
}

/** Le differenze che non contano: maiuscole e barra finale. */
function normalizza(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}
