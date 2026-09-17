-- =====================================================================
-- 0032 -- Codice fiscale, per chi la partita IVA non ce l'ha (17/09/2026)
--
-- Vendere a qualcuno senza partita IVA è normale e la fattura elettronica
-- si emette lo stesso: al posto della partita IVA si indica il codice
-- fiscale, con codice destinatario "0000000". Quello che manca è il posto
-- dove tenerlo -- Stripe raccoglie le partite IVA (`tax_id_collection`, con
-- verifica VIES per quelle europee) ma del codice fiscale non ha proprio il
-- concetto.
--
-- Come per la 0031: si salva solo ciò che Stripe non ha. Chi una partita IVA
-- ce l'ha lascia questa colonna vuota, e l'identificativo resta quello sul
-- Customer di Stripe.
--
-- Non scrivibile da `authenticated`: la 0030 concede l'UPDATE su un elenco
-- esplicito di colonne e questa non ci entra, quindi nasce già chiusa. La
-- riempie la server action delle impostazioni, dopo il controllo di permesso.
-- =====================================================================

alter table tenants add column codice_fiscale text;

comment on column tenants.codice_fiscale is
  'Codice fiscale del cliente, alternativo alla partita IVA (che vive sul Customer di Stripe). Serve per la fattura elettronica a chi non ha partita IVA.';
