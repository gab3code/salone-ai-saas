-- Promemoria automatici (Fase 6, trovato nel controllo promesse del sito
-- 13/09/2026, costruito il 14/09/2026): `Funzionalita.tsx` promette due cose
-- sotto questa voce, "Reminder prima dell'appuntamento e follow-up ai
-- clienti inattivi" -- entrambe hanno bisogno di un modo per sapere "questo
-- l'ho gia' avvisato", altrimenti un job schedulato che gira ogni giorno
-- manderebbe la stessa email piu' volte.
--
-- Due colonne separate, non una tabella "notifiche_inviate" generica:
-- stesso principio gia' seguito nel progetto (una colonna dedicata per fatto
-- dedicato, es. ore_minime_cancellazione appena sopra) -- piu' semplice da
-- interrogare ("promemoria_inviato_at is null") e non introduce
-- un'astrazione per un solo caso d'uso oggi.
alter table appuntamenti add column promemoria_inviato_at timestamptz;
alter table clienti add column promemoria_inattivita_inviato_at timestamptz;
