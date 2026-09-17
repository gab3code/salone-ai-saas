-- =====================================================================
-- 0031 -- Dati per la fattura elettronica che Stripe non raccoglie
--         (17/09/2026)
--
-- Allo SdI la partita IVA non basta: per trasmettere una fattura serve il
-- codice destinatario del cliente (7 caratteri) oppure la sua PEC. Stripe
-- raccoglie partita IVA e indirizzo di fatturazione da solo
-- (`tax_id_collection`, `billing_address_collection`) ma di questi due non
-- sa niente, quindi arrivano come campi personalizzati della sessione di
-- checkout e si salvano qui.
--
-- Si salva SOLO ciò che Stripe non ha. Partita IVA e indirizzo restano sul
-- Customer di Stripe, che li ha raccolti ed è la loro fonte di verità:
-- copiarli anche qui creerebbe due versioni della stessa informazione che
-- divergono alla prima modifica fatta dal Customer Portal.
--
-- Entrambe nullable: un'attività su Free o in prova non ha nessuna fattura
-- da ricevere, e non le si chiede niente.
-- =====================================================================

alter table tenants
  add column codice_destinatario text,
  add column pec_fatturazione text;

comment on column tenants.codice_destinatario is
  'Codice destinatario SdI (7 caratteri) dichiarato dal cliente al checkout. "0000000" = riceve via PEC o è un privato.';
comment on column tenants.pec_fatturazione is
  'PEC per la consegna della fattura elettronica, alternativa al codice destinatario.';

-- Scrivibili solo dal service_role, come tutte le colonne che descrivono il
-- rapporto contrattuale e non le preferenze del titolare: le riempie il
-- webhook di Stripe leggendo la sessione di checkout. Coerente con la
-- migrazione 0030, che concede a `authenticated` l'UPDATE solo su un elenco
-- esplicito di colonne -- queste due non ci entrano, quindi non serve
-- nessuna revoca: nascono già non scrivibili dal browser.
