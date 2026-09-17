import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` -- la funzione che ogni componente shadcn/21st.dev si aspetta di
 * trovare a `@/lib/utils`.
 *
 * Unisce classi condizionali (clsx) e poi risolve i conflitti Tailwind
 * (tailwind-merge): `cn("px-2", "px-4")` dà `px-4`, non entrambe. È il
 * motivo per cui esiste -- senza `twMerge`, una classe passata via prop non
 * riuscirebbe a sovrascrivere quella di default del componente, e ci si
 * ritroverebbe a combattere con `!important`.
 *
 * STORIA, perché non venga tolta di nuovo (17/09/2026). Questo file era
 * `export { cn } from "cn"` -- un pacchetto omonimo -- ed è stato cancellato
 * insieme a sei dipendenze orfane, con la regola giusta ("nessuno lo
 * importa") applicata alla cosa sbagliata. `components.json` dichiara
 * `"utils": "@/lib/utils"` e `"ui": "@/components/ui"`: non è codice morto,
 * è **impalcatura**, esiste per il codice non ancora scritto. La differenza
 * conta: il codice morto si toglie, l'impalcatura di un flusso di lavoro
 * dichiarato no.
 *
 * Rimessa con l'implementazione canonica (clsx + tailwind-merge) invece del
 * pacchetto `cn`: è quella che la documentazione di shadcn e i componenti di
 * 21st.dev danno per scontata, quindi un componente incollato funziona senza
 * ritocchi.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
