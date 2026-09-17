-- =====================================================================
-- 0034 -- L'esito della verifica VIES della partita IVA (17/09/2026)
--
-- Il carattere di controllo (src/lib/fiscale.ts) dice se una partita IVA è
-- BEN FORMATA, cioè intercetta il refuso. Non dice se esiste davvero né a chi
-- appartiene: "00743110158" con la cifra giusta al posto giusto passerebbe il
-- controllo anche se non fosse di nessuno.
--
-- L'esistenza la accerta VIES, il registro europeo, e Stripe la interroga da
-- sé ogni volta che creiamo un tax id su un customer. La verifica è
-- ASINCRONA: al momento della creazione lo stato è `pending` e diventa
-- `verified` o `unverified` qualche secondo o minuto dopo, quando VIES
-- risponde. Per questo non si può leggere l'esito subito dopo aver salvato --
-- arriva con l'evento `customer.tax_id.updated`, e queste colonne sono dove
-- lo mettiamo.
--
-- `partita_iva_nome_verificato` è il nome che VIES restituisce per quella
-- partita IVA: confrontarlo con la ragione sociale dichiarata è il controllo
-- più utile di tutti, perché intercetta la partita IVA di qualcun altro --
-- copiata, inventata o sbagliata di una cifra in modo fortunato.
--
-- Nessuno di questi valori BLOCCA un pagamento, di proposito: VIES è spesso
-- irraggiungibile e una partita IVA valida può tornare "non verificabile"
-- per un disservizio. Servono a segnalare, non a impedire.
-- =====================================================================

alter table tenants
  add column partita_iva_verifica text,
  add column partita_iva_nome_verificato text;

comment on column tenants.partita_iva_verifica is
  'Esito VIES riportato da Stripe: pending | verified | unverified. NULL = mai verificata.';
comment on column tenants.partita_iva_nome_verificato is
  'Ragione sociale che VIES associa a quella partita IVA, quando la restituisce. Da confrontare con denominazione.';
