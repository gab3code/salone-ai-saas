/**
 * Rete di sicurezza deterministica contro il markdown che il modello scrive
 * nonostante la regola 9 del system prompt lo vieti esplicitamente (trovato
 * dal vivo il 15/09/2026, vedi DECISIONS.md: "Che servizi offrite?" ha
 * prodotto un elenco puntato con trattini -- "- Manicure: ...\n- Pedicure:
 * ..." -- che il widget mostra così com'è, senza interpretarlo). Non è la
 * prima volta che il solo prompt non basta su questa regola (vedi il fix
 * precedente sugli asterischi letterali in PIANO.md/DECISIONS.md) -- stesso
 * principio già seguito per verifica-numeri.ts: su qualcosa che il cliente
 * vede sempre, un'istruzione al modello resta un buon primo livello ma non
 * una garanzia, quindi ripuliamo anche a livello di codice prima di mandare
 * il testo al cliente.
 *
 * Funzione pura, senza IO: rimuove i marcatori markdown più comuni
 * mantenendo il testo -- non riscrive né riformula nulla, quindi non può
 * introdurre un'altra invenzione.
 */
export function pulisciMarkdown(testo: string): string {
  return (
    testo
      // **grassetto** e __grassetto__ -> grassetto
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // *corsivo* e _corsivo_ -> corsivo (dopo aver già tolto ** e __, quindi
      // un singolo asterisco/underscore rimasto è per forza enfasi singola)
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/(?<![\w])_(.+?)_(?![\w])/g, "$1")
      // titoli "# Titolo" / "## Titolo" a inizio riga -> solo il testo
      .replace(/^#{1,6}\s+/gm, "")
      // elenchi puntati "- voce" / "* voce" / "• voce" a inizio riga -> solo
      // il testo (la regola 9 vieta i puntati, ma se restano gli a capo del
      // modello il risultato somiglia comunque a un elenco leggibile)
      .replace(/^[ \t]*[-*•][ \t]+/gm, "")
      // non più di una riga vuota consecutiva
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
