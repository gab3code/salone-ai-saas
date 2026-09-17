import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chiaveLimiteIp, ipDaIntestazioni, type TettiIp } from "@/lib/limiti-ip";

/**
 * Impronta dell'indirizzo, non l'indirizzo.
 *
 * Nel database non finisce nessun IP: finisce uno SHA-256 dell'indirizzo piu'
 * un sale del server. Serve a riconoscere che due richieste vengono dalla
 * stessa parte, che e' tutto quello che un contatore deve sapere -- non a
 * sapere da dove vengono. Un indirizzo IP e' un dato personale, e per contare
 * non serve conservarlo.
 *
 * Il sale non e' un segreto crittografico e il suo scopo e' modesto: senza,
 * l'insieme degli IP possibili e' abbastanza piccolo da essere provato tutto,
 * e le impronte tornerebbero a essere indirizzi. Se `SALT_LIMITI_IP` manca si
 * usa comunque un valore fisso: il limite deve funzionare anche in un
 * ambiente configurato a meta', perche' un tetto che si spegne da solo quando
 * manca una variabile non e' un tetto.
 */
function improntaIp(ip: string): string {
  const sale = process.env.SALT_LIMITI_IP ?? "salone-ai-limiti-ip";
  return createHash("sha256").update(`${sale}:${ip}`).digest("hex").slice(0, 32);
}

export type EsitoLimiteIp =
  | { consentito: true; restanti: number }
  | { consentito: false; motivo: "tetto" | "sconosciuto" };

/**
 * Consuma un uso dell'AI per questo chiamante.
 *
 * Va chiamata PRIMA di qualunque cosa costi, ed e' il primo controllo di
 * tutti: un tentativo respinto qui non deve consumare ne' la quota del
 * salone ne' quella globale della demo, altrimenti un aggressore riuscirebbe
 * comunque a togliere qualcosa a qualcun altro.
 *
 * Se non si riesce a leggere l'indirizzo (sviluppo in locale, intestazioni
 * assenti) si LASCIA PASSARE: dietro restano comunque tutti gli altri tetti,
 * e bloccare tutti quanti perche' manca un'intestazione sarebbe un danno
 * peggiore del problema. Il caso e' segnalato nei log.
 *
 * Se invece e' il DATABASE a non rispondere si BLOCCA. Qui la scelta e'
 * opposta a quella della quota mensile per tenant (che lascia passare per non
 * rovinare la prenotazione di un cliente vero) perche' questo controllo
 * esiste solo contro l'abuso: in dubbio, meglio un messaggio in meno a una
 * persona in buona fede che una difesa che si spegne proprio quando serve.
 */
export async function consumaUsoAiPerIp(
  admin: SupabaseClient,
  intestazioni: { get(nome: string): string | null },
  ambito: "demo" | "chat",
  tetti: TettiIp
): Promise<EsitoLimiteIp> {
  const ip = ipDaIntestazioni(intestazioni);
  if (!ip) {
    console.warn(`[limiti-ip] nessun indirizzo nelle intestazioni (ambito ${ambito}): lascio passare.`);
    return { consentito: true, restanti: tetti.perOra };
  }

  const { data, error } = await admin.rpc("consuma_limite_ip", {
    p_chiave: chiaveLimiteIp(ambito, improntaIp(ip)),
    p_limite_ora: tetti.perOra,
    p_limite_giorno: tetti.perGiorno,
  });

  if (error) {
    console.error(`[limiti-ip] controllo fallito (ambito ${ambito}):`, error.message);
    return { consentito: false, motivo: "sconosciuto" };
  }
  if (typeof data !== "number" || data < 0) return { consentito: false, motivo: "tetto" };
  return { consentito: true, restanti: data };
}

/** Cancella le finestre vecchie. Chiamata dal giro notturno. */
export async function pulisciLimitiIp(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("pulisci_limiti_ip");
  if (error) {
    console.error("[limiti-ip] pulizia fallita:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
