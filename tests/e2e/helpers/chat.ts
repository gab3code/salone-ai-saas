import type { Page } from "@playwright/test";

/**
 * Helper per la chat AI pubblica (`ChatWidgetPubblico.tsx`) -- niente
 * `data-testid` nel componente (non ce n'era bisogno prima di questi test),
 * quindi qui ci si appoggia a `aria-label`/placeholder/testo visibile, già
 * scelti con cura nel componente per l'accessibilità e quindi stabili.
 *
 * Anti-burst reale (`INTERVALLO_MINIMO_MS_TRA_MESSAGGI` = 2000ms, vedi
 * limiti.ts): un vero cliente non scrive due messaggi a meno di 2 secondi di
 * distanza, e l'endpoint rifiuta chi lo fa. Aspettare la risposta dell'AI
 * (che richiede comunque una chiamata di rete reale a Claude) basta quasi
 * sempre a rispettare il minimo da sola; `attendiAlmenoDueSecondi` esiste
 * solo per il caso limite di una risposta anomalmente rapida.
 */

export async function apriChat(page: Page) {
  await page.getByRole("button", { name: "Apri chat" }).click();
}

async function attendiAlmenoDueSecondi(dallaPartenza: number) {
  const trascorsi = Date.now() - dallaPartenza;
  if (trascorsi < 2100) await new Promise((r) => setTimeout(r, 2100 - trascorsi));
}

/**
 * Scrive un messaggio nella chat già aperta e aspetta la risposta
 * dell'assistente (fine di "Sta scrivendo...", poi legge l'ultimo fumetto
 * lato AI). Ritorna il testo della risposta per le asserzioni del test.
 */
export async function inviaMessaggioChat(page: Page, testo: string): Promise<string> {
  const partenza = Date.now();
  await page.getByPlaceholder("Scrivi un messaggio...").fill(testo);
  await page.getByRole("button", { name: "Invia" }).click();
  // "Sta scrivendo..." compare subito e sparisce alla risposta -- aspettarne
  // la scomparsa è più affidabile di un timeout fisso, la latenza di Claude
  // varia parecchio da un turno all'altro (soprattutto quando usa un tool).
  await page.getByText("Sta scrivendo...").waitFor({ state: "hidden", timeout: 45_000 });
  await attendiAlmenoDueSecondi(partenza);
  // L'ultimo fumetto lato assistente (sfondo zinc-100, allineato a sinistra)
  // dopo l'ultimo fumetto lato cliente appena inviato.
  const fumetti = page.locator("p.max-w-\\[85\\%\\]");
  return (await fumetti.last().innerText()).trim();
}
