-- 0058: un'associazione operatore-servizio non puo' attraversare due saloni.
--
-- La policy della 0030 controllava SOLO l'operatore:
--
--   exists (select 1 from operatori o
--           where o.id = operatore_id and o.tenant_id = auth_tenant_id())
--
-- Il servizio non lo guardava nessuno. Con l'UUID di un servizio di un altro
-- salone -- non un segreto: basta averlo visto una volta, per esempio da una
-- pagina pubblica -- un titolare poteva scrivere una riga che collega un suo
-- operatore a un servizio altrui. Da li' il motore di disponibilita'
-- avrebbe proposto slot per un servizio che in quel salone non esiste.
--
-- Nessuno lo ha sfruttato (la UI non offre il modo di provarci), ma la
-- regola vale lo stesso: un permesso che sta solo nell'interfaccia non e'
-- un permesso. Trovato il 18/09/2026 mentre si mappavano le azioni per
-- l'onboarding AI capace di modificare -- cioe' dal leggere il codice, non
-- da un incidente.

drop policy if exists lettura_tenant on operatori_servizi;
create policy lettura_tenant on operatori_servizi
  for select
  using (
    exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id())
    and exists (select 1 from servizi s where s.id = servizio_id and s.tenant_id = auth_tenant_id())
  );

drop policy if exists scrittura_owner_insert on operatori_servizi;
create policy scrittura_owner_insert on operatori_servizi
  for insert
  with check (
    e_owner()
    and exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id())
    and exists (select 1 from servizi s where s.id = servizio_id and s.tenant_id = auth_tenant_id())
  );

drop policy if exists scrittura_owner_delete on operatori_servizi;
create policy scrittura_owner_delete on operatori_servizi
  for delete
  using (
    e_owner()
    and exists (select 1 from operatori o where o.id = operatore_id and o.tenant_id = auth_tenant_id())
    and exists (select 1 from servizi s where s.id = servizio_id and s.tenant_id = auth_tenant_id())
  );
