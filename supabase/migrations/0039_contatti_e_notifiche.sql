-- =====================================================================
-- 0039 -- Il WhatsApp dell'attività, e chi riceve cosa (17/09/2026)
--
-- Due cose decise da Gabriel nella stessa conversazione, una conseguenza
-- dell'altra.
--
-- 1) `telefono_whatsapp` -- il canale su cui l'assistente scarica la palla
--
-- Quando l'AI non sa risolvere qualcosa (reclami, casi fuori dal normale,
-- richiesta esplicita di parlare con una persona) finora il prodotto aveva
-- due strade, ed erano entrambe monche: dire "contatta l'attività" senza
-- dire come, oppure -- versione durata poche ore lo stesso giorno --
-- mandare un'email al titolare con la trascrizione. La seconda è stata
-- scartata da Gabriel per tre motivi giusti: lascia comunque appeso chi ha
-- scritto, arriva su un canale che un titolare al lavoro non guarda, e non
-- c'è nessun posto nel prodotto dove rispondere.
--
-- La scelta è l'opposta: si dà al cliente il modo di farsi sentire SUBITO,
-- sul canale dove il salone lavora già. `tenants.telefono` esiste dalla
-- 0001 ed è già mostrato sulla pagina pubblica; qui si aggiunge il numero
-- WhatsApp, che per molte attività è lo stesso ma non sempre.
--
-- NOME DELLA COLONNA: `telefono_whatsapp`, NON `whatsapp_numero`. Su
-- `tenants` esistono già `whatsapp_phone_number_id`, `whatsapp_business_id`,
-- `whatsapp_waba_id` e `whatsapp_stato`, che sono gli identificativi
-- dell'API di Meta (migrazioni 0001 e 0003) e non hanno niente a che fare
-- con un numero da mostrare a un cliente. Mettere una quinta colonna nello
-- stesso prefisso avrebbe garantito che prima o poi qualcuno leggesse
-- quella sbagliata. Il prefisso `telefono_` dice invece esattamente cos'è:
-- il fratello di `telefono`.
--
-- 2) Chi riceve le notifiche di prenotazione
--
-- Oggi non si può scegliere: il titolare riceve un'email per OGNI
-- prenotazione e non ha modo di spegnerla, e il cliente riceve l'email (o
-- l'SMS se non ha lasciato un'email, sui piani che lo includono) senza che
-- il salone possa decidere altrimenti. Sono le uniche due notifiche del
-- prodotto senza un interruttore: promemoria, compleanno, recensioni e
-- lista d'attesa ce l'hanno già tutte.
--
-- `conferma_cliente_canale` è un testo con `check`, non quattro booleani:
-- le quattro possibilità si escludono a vicenda, e con i booleani si
-- arriverebbe a stati che non vogliono dire niente (email=false e sms=false
-- e "manda comunque"?). I valori:
--   email_o_sms  -- come oggi: email a chi l'ha lasciata, SMS agli altri
--                   (default, perché è il comportamento attuale e nessun
--                   tenant esistente deve cambiare comportamento da solo)
--   solo_email   -- chi non ha lasciato un'email non riceve niente
--   solo_sms     -- SMS a chiunque abbia un numero, anche a chi ha l'email
--   nessuna      -- il cliente non riceve nulla
--
-- L'SMS resta comunque dietro al piano: `inviaSmsSeInclusoNelPiano`
-- ricontrolla piano e quota a ogni invio, quindi un tenant Growth che
-- scegliesse `solo_sms` non manderebbe niente. Per non lasciarlo in quello
-- stato assurdo il gate è applicato due volte -- la UI non mostra le
-- opzioni SMS sotto Pro, e la server action le rifiuta -- stesso doppio
-- controllo già usato per il tono dell'AI e la knowledge base.
--
-- GRANT: la 0030 ha stabilito che su `tenants` si concede l'UPDATE colonna
-- per colonna. Queste tre sono configurazione dell'attività, quindi entrano
-- nell'elenco; e resta vero che ogni colonna NON elencata nasce chiusa.
-- =====================================================================

alter table tenants
  add column telefono_whatsapp text,
  add column notifica_titolare_nuova_prenotazione boolean not null default true,
  add column conferma_cliente_canale text not null default 'email_o_sms'
    check (conferma_cliente_canale in ('email_o_sms', 'solo_email', 'solo_sms', 'nessuna'));

comment on column tenants.telefono_whatsapp is
  'Numero WhatsApp da MOSTRARE ai clienti (non un identificativo dell''API Meta: quelli sono le colonne whatsapp_*). Usato dall''assistente quando passa la mano a una persona, e dalla pagina pubblica.';

comment on column tenants.notifica_titolare_nuova_prenotazione is
  'false = il titolare non riceve l''email a ogni nuova prenotazione. Non tocca nulla di quello che ricevono i clienti.';

comment on column tenants.conferma_cliente_canale is
  'Come il cliente finale riceve la conferma della propria prenotazione. L''SMS resta comunque limitato ai piani che lo includono.';

grant update (
  telefono_whatsapp,
  notifica_titolare_nuova_prenotazione,
  conferma_cliente_canale
) on public.tenants to authenticated;
