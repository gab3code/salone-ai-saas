# Salone AI SaaS

SaaS self-service per centri estetici/parrucchieri/barbieri: prenotazioni via WhatsApp
gestite da un assistente AI, calendario, CRM, dashboard, abbonamenti. Vedi `PIANO.md` per
lo stato di avanzamento a fasi e `docs/analisi-estetia.md` per l'analisi del concorrente
di riferimento (estetia.tidycode.it).

## Stack
Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, RLS, Storage, Edge Functions)
+ Tailwind CSS + Stripe. Vedi `supabase/migrations/0001_init.sql` per lo schema dati
multi-tenant iniziale.

## Setup locale
1. `npm install`
2. Copia `.env.example` in `.env.local` e compila i valori (vedi `PIANO.md` per cosa serve
   subito e cosa puo' aspettare).
3. `npm run dev`

## Provenienza
Progetto precedente (bot WhatsApp per un singolo salone, Flask + Google Calendar, senza
database ne' multi-tenancy) nella cartella "Claude Project", sullo stesso Desktop. Non e'
stato migrato: stack diverso per scelta deliberata (vedi PIANO.md). La logica di prenotazione
(gestione slot, policy di cancellazione, architettura "l'AI interpreta, il backend decide")
e il wrapper API WhatsApp sono stati studiati e in parte riportati qui come riferimento.
