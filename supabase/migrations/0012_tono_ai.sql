-- Tono dell'AI personalizzabile (Fase 5, pubblicizzato su Pro in Prezzi.tsx
-- ma inesistente nel codice prima di oggi -- trovato nel mega-controllo
-- competitor del 12/09/2026, BLOCCANTE prima di aprire i pagamenti veri su
-- Pro, vedi PIANO.md/DECISIONS.md). Guidato a domande (poche opzioni fisse)
-- invece di un prompt libero, come raccomandato in docs/analisi-estetia.md
-- punto 3: più accessibile per chi non sa scrivere un prompt, e più sicuro
-- (nessun rischio che il titolare scriva per sbaglio un'istruzione che
-- confligge con le regole assolute del system prompt in src/lib/ai/agente.ts).
--
-- `tono_ai_nota` è una piccola valvola di sfogo in PIÙ, non l'unico modo di
-- personalizzare: testo libero ma breve (validato lato applicativo a 300
-- caratteri, oltre al check qui) e trattato SEMPRE come indicazione
-- supplementare, mai come sostituto delle regole assolute -- vedi
-- `costruisciSystemPrompt` in agente.ts per come viene incorniciata.

alter table tenants
  add column tono_ai text not null default 'professionale'
    check (tono_ai in ('professionale', 'amichevole', 'informale_con_emoji')),
  add column tono_ai_nota text check (tono_ai_nota is null or char_length(tono_ai_nota) <= 300);
