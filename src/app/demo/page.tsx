import { redirect } from "next/navigation";
import { SLUG_DEMO_GROWTH } from "@/lib/demo";

/**
 * L'indirizzo fisso della demo.
 *
 * `/demo` e' quello che si scrive su una slide, si manda in un messaggio e
 * si mette su un pulsante della landing; `/s/demo` e' dove vive davvero,
 * perche' la demo NON e' una pagina a parte: e' la stessa identica pagina
 * pubblica che ha ogni salone, con dentro dati finti. Una demo costruita a
 * parte finirebbe per divergere dal prodotto vero al primo cambio, ed e'
 * esattamente il difetto delle demo che non convincono nessuno.
 */
export default function PaginaDemo() {
  redirect(`/s/${SLUG_DEMO_GROWTH}`);
}
