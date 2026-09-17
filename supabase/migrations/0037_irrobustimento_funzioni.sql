-- =====================================================================
-- 0037 -- Irrobustimento delle funzioni di sicurezza (17/09/2026)
--
-- Trovato lanciando il linter di sicurezza di Supabase durante il controllo
-- notturno -- un controllo che non era mai stato fatto su questo progetto.
-- Tre cose, tutte piccole, tutte a costo zero da sistemare.
--
-- 1) `e_owner()` non aveva `search_path` fissato (e, a differenza di
--    `auth_ruolo()` che le sta accanto nella 0030, non era security
--    definer).
--
--    Funziona lo stesso perché chiama `auth_ruolo()`, che invece lo è. Ma
--    una funzione senza `search_path` fissato risolve i nomi usando il
--    search_path di CHI la chiama, e questa funzione è il cancello che
--    separa un titolare da un dipendente in una policy RLS: se qualcuno
--    riuscisse a farsi trovare prima un proprio `auth_ruolo()`, `e_owner()`
--    direbbe di sì a chiunque. Oggi `authenticated` non può creare oggetti
--    dove servirebbe, quindi non è una falla aperta -- è una difesa che
--    dipende da un'altra impostazione invece che da sé stessa, che è
--    esattamente il tipo di cosa che si rompe in silenzio.
--
--    Si aggiunge `set search_path = public`, e `security definer` per
--    allinearla a quello che la 0030 dichiara: legge `profiles` tramite
--    `auth_ruolo()`, che a sua volta filtra già su `auth.uid()` -- non può
--    restituire niente che non riguardi chi sta chiamando.
--
-- 2) `gestisci_nuovo_utente()` e `rls_auto_enable()` sono richiamabili via
--    `/rest/v1/rpc/...` da `anon` e da `authenticated`.
--
--    VERIFICATO invece di dedotto, prima di decidere cosa fare: chiamando
--    `public.gestisci_nuovo_utente()` il database risponde
--    "trigger functions can only be called as triggers". Non è una
--    difesa nostra, è Postgres che rifiuta a monte; `rls_auto_enable`
--    ritorna `event_trigger` ed è nella stessa condizione. L'esposizione
--    reale è quindi zero, e l'avviso del linter è formale.
--
--    Si tolgono i permessi espliciti a `anon` e `authenticated`, che è la
--    parte gratuita. NON si revoca da `PUBLIC`, che è quello che
--    zittirebbe del tutto l'avviso: `gestisci_nuovo_utente` è il trigger
--    che crea l'attività di ogni nuovo iscritto, e scambiare un avviso
--    formale con anche solo il dubbio di rompere la registrazione è un
--    pessimo affare. Se un giorno lo si vuole fare, si fa dopo aver
--    provato una registrazione vera su un ambiente di prova -- non di
--    notte, non alla cieca.
--
--    `auth_tenant_id()` e `auth_ruolo()` restano richiamabili, e va bene:
--    rispondono solo su chi sta chiamando (`auth.uid()`), quindi dicono a
--    un utente una cosa che sa già.
--
-- COSA IL LINTER SEGNALA E RESTA COM'È, con il motivo:
--  - `btree_gist` nello schema `public`: serve al vincolo di esclusione
--    `niente_sovrapposizioni` (migrazione 0001), che è il motivo per cui
--    due clienti non possono prenotare lo stesso slot. Spostarla di schema
--    per silenziare un avviso significherebbe toccare l'unico vincolo che
--    protegge l'agenda. No.
--  - `interventi_admin` e `whatsapp_credenziali` con RLS attiva e zero
--    policy: è voluto e scritto nelle rispettive migrazioni -- ci arriva
--    solo il `service_role`, nessun utente autenticato deve leggerle.
--    "Zero policy" qui è la policy.
-- =====================================================================

create or replace function e_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth_ruolo() in ('owner', 'admin_piattaforma'), false)
$$;

revoke execute on function public.gestisci_nuovo_utente() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
