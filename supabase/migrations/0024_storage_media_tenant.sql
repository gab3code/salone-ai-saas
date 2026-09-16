-- Fase 4 (galleria/upload immagini): bucket di Storage per logo e foto di
-- copertina del salone (colonne tenants.logo_url/cover_url, esistenti dallo
-- schema iniziale ma finora senza nessun modo di caricarle -- vedi PIANO.md).
--
-- Convenzione di percorso: "<tenant_id>/logo" e "<tenant_id>/cover", SENZA
-- estensione nel nome file -- il content-type viene salvato come metadato
-- dell'oggetto al momento dell'upload (src/lib/storage/media-tenant.ts) e
-- Supabase lo restituisce correttamente in risposta, quindi non serve
-- tracciare l'estensione originale. Upload con `upsert: true`: un nuovo
-- caricamento sovrascrive il precedente invece di accumulare file orfani.
--
-- Lettura pubblica: queste immagini sono mostrate sulla pagina pubblica del
-- salone (/s/[slug]), vista da clienti anonimi -- devono essere leggibili
-- senza autenticazione. Scrittura riservata al titolare del proprio tenant,
-- stesso helper `auth_tenant_id()` già usato per isolare tutte le altre
-- tabelle di dominio (migrazione 0001).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-tenant', 'media-tenant', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy media_tenant_lettura_pubblica
on storage.objects for select
using (bucket_id = 'media-tenant');

create policy media_tenant_upload_proprio_tenant
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media-tenant'
  and (storage.foldername(name))[1] = auth_tenant_id()::text
);

create policy media_tenant_aggiornamento_proprio_tenant
on storage.objects for update
to authenticated
using (bucket_id = 'media-tenant' and (storage.foldername(name))[1] = auth_tenant_id()::text)
with check (bucket_id = 'media-tenant' and (storage.foldername(name))[1] = auth_tenant_id()::text);

create policy media_tenant_cancellazione_proprio_tenant
on storage.objects for delete
to authenticated
using (bucket_id = 'media-tenant' and (storage.foldername(name))[1] = auth_tenant_id()::text);
