-- 0062: anche il richiamo scritto dall'assistente consuma la quota.
--
-- Il messaggio ai clienti che non tornano, su Pro, lo scrive il modello
-- leggendo la storia di quel cliente (vedi src/lib/follow-up-ai.ts). E' una
-- chiamata ad Anthropic fatta per conto del salone come tutte le altre, e
-- deve comparire nello stesso numero: un costo solo, un contatore solo.
--
-- Nota su cosa succede quando la quota finisce: il richiamo parte lo stesso,
-- col messaggio fisso. Saltare il contatto per un tetto nostro farebbe
-- perdere al salone un cliente vero per un problema che non e' suo.

alter table usi_ai_interni drop constraint if exists usi_ai_interni_tipo_check;
alter table usi_ai_interni
  add constraint usi_ai_interni_tipo_check
  check (tipo in ('onboarding', 'prova_assistente', 'follow_up'));
