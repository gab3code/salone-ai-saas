-- Le SELECT che la 0049 aveva deciso di non toccare (18/09/2026).
--
-- La 0049 chiuse le scritture e scrisse, nero su bianco: "Le SELECT non si
-- toccano: quelle le governano le policy, e la pagina pubblica ne ha
-- bisogno." La prima meta' di quella frase e' vera. La seconda no, e a
-- dimostrarlo e' la produzione stessa: li' il ruolo `anon` non ha SELECT su
-- NESSUNA tabella, da sempre, e la pagina pubblica di prenotazione funziona
-- benissimo -- perche' parla col server, non col database.
--
-- La differenza si e' vista solo ricostruendo un database da zero per i
-- test: 30 permessi che in produzione qualcuno aveva tolto a mano anni luce
-- fa e che nessun file aveva mai registrato. Fra questi, `anon` e
-- `authenticated` con SELECT su `whatsapp_credenziali` -- la tabella che la
-- 0005 dichiara esplicitamente di voler lasciare senza NESSUN permesso,
-- "doppia difesa per un vero segreto". Nel database di test quella doppia
-- difesa era una sola.
--
-- Trovate da `npm run permessi`, il giorno dopo averlo scritto. E' la terza
-- volta in ventiquattr'ore che lo stesso difetto si presenta: un permesso
-- tolto a mano in un posto solo non e' un permesso tolto.
--
-- Qui si allinea il database di test alla produzione, e soprattutto si
-- scrive in un file quello che finora esisteva solo nella memoria di chi
-- l'aveva fatto.
--
-- Nessun rischio di rompere la pagina pubblica: in produzione questo stato
-- e' gia' quello attuale. E nessun componente lato browser interroga
-- tabelle -- controllato file per file prima di scrivere questa migrazione.

revoke select on all tables in schema public from anon;

-- Tabelle interne: contatori, registro interventi admin, limiti per IP e
-- credenziali WhatsApp. Le tocca solo il server con la service_role key.
revoke select on public.contatori_globali from authenticated;
revoke select on public.interventi_admin from authenticated;
revoke select on public.limiti_ip from authenticated;
revoke select on public.whatsapp_credenziali from authenticated;
