-- 0063: il report mensile di Pro.
--
-- Una volta al mese il titolare riceve, senza doverlo chiedere, il riassunto
-- di com'e' andato: e' la cosa che nessuno ha tempo di fare da solo. I
-- numeri li conta il codice, il commento lo scrive l'assistente e non puo'
-- contenere cifre (vedi src/lib/report-mensile.ts) -- cosi' un titolare non
-- puo' prendere una decisione su un numero che il modello ricorda male.
--
-- La colonna qui sotto e' la memoria di "gia' mandato": il cron gira tutte
-- le notti, il report no.

alter table tenants
  add column if not exists report_mensile_inviato text;

comment on column tenants.report_mensile_inviato is
  'Ultimo mese per cui e'' stato spedito il report (formato YYYY-MM). NULL = mai spedito.';
