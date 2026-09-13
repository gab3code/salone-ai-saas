/**
 * Esportazione CSV clienti (PIANO.md, "Export/import CSV clienti", trovato
 * nel secondo giro mega-controllo 12/09/2026: "utile per un titolare che
 * migra da un altro gestionale o vuole i propri dati per un mailing
 * esterno"). Solo l'EXPORT per ora -- l'import resta da fare a parte: leggere
 * un CSV esterno richiede validazione, anteprima e gestione dei duplicati
 * (numero di telefono già esistente, righe malformate), lavoro non
 * "contenuto" quanto la sola esportazione, quindi non incluso qui.
 *
 * Funzione pura testabile senza database, stesso principio di separazione di
 * metriche.ts/booking-engine.ts -- il layer di connessione (la route
 * handler in dashboard/clienti/export/route.ts) carica solo i dati grezzi e
 * delega SEMPRE qui la formattazione.
 */

export interface ClienteEsportabile {
  nome: string | null;
  telefono: string | null;
  email: string | null;
  tag: string[] | null;
  // Stessa etichetta "AI"/"Manuale" già mostrata in /dashboard/clienti oggi
  // (limite noto, non introdotto qui: un cliente "pubblico" risulta ancora
  // "Manuale", vedi PIANO.md sulla migrazione di creato_da_ai a testo).
  origine: string;
  createdAt: Date;
}

const INTESTAZIONE = ["Nome", "Telefono", "Email", "Tag", "Origine", "Cliente da"];

/**
 * Un campo va racchiuso tra virgolette (con le virgolette interne
 * raddoppiate) solo se contiene un separatore, una virgoletta o un ritorno a
 * capo -- RFC 4180. Lasciare invariati gli altri campi mantiene il file più
 * leggibile aperto come testo semplice.
 */
function campoCsv(valore: string): string {
  if (/[",\n\r]/.test(valore)) {
    return `"${valore.replace(/"/g, '""')}"`;
  }
  return valore;
}

/**
 * BOM UTF-8 in testa: senza, Excel su Windows (il caso d'uso più comune per
 * un titolare che scarica un CSV per un mailing) interpreta il file come
 * Latin-1 e rompe qualunque accento (nomi italiani compresi). "\r\n" come
 * terminatore di riga per lo stesso motivo di compatibilità.
 */
export function clientiACsv(clienti: ClienteEsportabile[]): string {
  const righe = [INTESTAZIONE.join(",")];
  for (const c of clienti) {
    righe.push(
      [
        c.nome ?? "",
        c.telefono ?? "",
        c.email ?? "",
        (c.tag ?? []).join("; "),
        c.origine,
        c.createdAt.toISOString().slice(0, 10),
      ]
        .map(campoCsv)
        .join(",")
    );
  }
  return "﻿" + righe.join("\r\n") + "\r\n";
}
