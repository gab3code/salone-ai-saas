-- Fix bug reale (stesso pattern di 0007): 0008 aveva concesso i permessi SQL
-- solo a service_role, dimenticando authenticated -- il ruolo usato dalla
-- dashboard quando un utente loggato legge/scrive le proprie righe sotto RLS.
-- RLS da solo non basta: è un controllo indipendente dal GRANT di tabella.
-- Scoperto dal vivo l'11/09/2026: /dashboard/impostazioni/calendari dava un
-- errore 500 (permission denied) per un utente reale appena collegato al
-- deploy Vercel, nonostante la policy RLS fosse corretta.
grant select, insert, update, delete on public.collegamenti_calendario_esterni to authenticated;
grant select, insert, update, delete on public.eventi_calendario_esterni to authenticated;
