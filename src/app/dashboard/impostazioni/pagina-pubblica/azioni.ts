"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import {
  BUCKET_MEDIA_TENANT,
  colonnaUrlMedia,
  percorsoOggettoMedia,
  urlMediaConCacheBuster,
  validaFileMedia,
  type TipoMediaTenant,
} from "@/lib/storage/media-tenant";

const PERCORSO = "/dashboard/impostazioni/pagina-pubblica";

/**
 * Logo/copertina del salone (Fase 4, galleria foto -- vedi PIANO.md e
 * migrazione 0024_storage_media_tenant.sql). Disponibile su TUTTI i piani,
 * non solo Pro/Enterprise: ogni salone ha una pagina pubblica fin dal piano
 * Free (Fase 4), stesso principio già seguito per i campi CRM di base.
 *
 * Upload fatto con il client autenticato dell'utente (non il client admin):
 * le policy RLS sul bucket (`auth_tenant_id()`, stesso helper di tutte le
 * altre tabelle) sono l'unica cosa che decide se può scrivere in quella
 * cartella, qui non serve ricontrollarlo a mano.
 */
export async function caricaMediaTenant(tipo: TipoMediaTenant, formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errore: "Nessun file selezionato." };
  }

  const erroreValidazione = validaFileMedia(file);
  if (erroreValidazione) return { errore: erroreValidazione };

  const percorso = percorsoOggettoMedia(tenantId, tipo);
  const { error: erroreUpload } = await supabase.storage
    .from(BUCKET_MEDIA_TENANT)
    .upload(percorso, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (erroreUpload) {
    return { errore: `Errore durante il caricamento: ${erroreUpload.message}` };
  }

  const { data: pubblico } = supabase.storage.from(BUCKET_MEDIA_TENANT).getPublicUrl(percorso);
  const url = urlMediaConCacheBuster(pubblico.publicUrl);

  const { data: tenantAggiornato, error: erroreUpdate } = await supabase
    .from("tenants")
    .update({ [colonnaUrlMedia(tipo)]: url })
    .eq("id", tenantId)
    .select("slug")
    .single();
  if (erroreUpdate) {
    return { errore: `Immagine caricata ma non salvata sul profilo: ${erroreUpdate.message}` };
  }

  revalidatePath(PERCORSO);
  if (tenantAggiornato?.slug) revalidatePath(`/s/${tenantAggiornato.slug}`);

  return { ok: true as const, url };
}

/** Rimuove logo/copertina: svuota solo la colonna, l'oggetto nello Storage resta
 * (al massimo 4MB, non vale la complessità di ripulirlo qui -- si sovrascrive da
 * solo al prossimo upload dello stesso tipo). */
export async function rimuoviMediaTenant(tipo: TipoMediaTenant) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const { data: tenantAggiornato, error } = await supabase
    .from("tenants")
    .update({ [colonnaUrlMedia(tipo)]: null })
    .eq("id", tenantId)
    .select("slug")
    .single();

  revalidatePath(PERCORSO);
  if (tenantAggiornato?.slug) revalidatePath(`/s/${tenantAggiornato.slug}`);

  return error ? { errore: `Errore rimuovendo l'immagine: ${error.message}` } : { ok: true as const };
}
