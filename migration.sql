-- ============================================================
-- RegioMap: Erzeuger-Login - Datenbank-Migration
-- Im Supabase SQL-Editor oder ueber die VS-Code-Postgres-Verbindung
-- Zeile fuer Zeile / Block fuer Block ausfuehren.
-- ============================================================
 
-- 1) Echte Admin-Tabelle statt "jeder eingeloggte Nutzer = Admin"
--    (die alten Policies erlaubten das bisher versehentlich)
create table if not exists admins (
  user_id uuid primary key references auth.users(id)
);
 
-- 2) Verknuepfung zwischen einem Anbieter-Eintrag und einem
--    Supabase-Auth-Nutzer (dem Erzeuger)
alter table anbieter add column if not exists user_id uuid references auth.users(id);
 
-- 3) Alte, zu grosszuegige Admin-Policies entfernen
drop policy if exists "Admins can view all anbieter" on anbieter;
drop policy if exists "Admins can manage anbieter" on anbieter;
 
-- 4) Neue Admin-Policies: nur wer in der admins-Tabelle steht
create policy "Admins can view all anbieter"
on anbieter for select
to authenticated
using (exists (select 1 from admins where admins.user_id = auth.uid()));
 
create policy "Admins can manage anbieter"
on anbieter for all
to authenticated
using (exists (select 1 from admins where admins.user_id = auth.uid()))
with check (exists (select 1 from admins where admins.user_id = auth.uid()));
 
-- 5) Erzeuger-Policies: ein Erzeuger sieht/bearbeitet nur seinen EIGENEN Eintrag
create policy "Producers can view own anbieter"
on anbieter for select
to authenticated
using (user_id = auth.uid());
 
create policy "Producers can update own anbieter"
on anbieter for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
 
-- 6) RLS fuer die ereignisse-Tabelle (Kalender-Termine)
alter table ereignisse enable row level security;
 
-- Oeffentlich lesbar (fuer die normale App-Ansicht, wie bisher)
drop policy if exists "Ereignisse oeffentlich lesbar" on ereignisse;
create policy "Ereignisse oeffentlich lesbar"
on ereignisse for select
to public
using (true);
 
-- Admins duerfen alle Termine verwalten
drop policy if exists "Admins manage ereignisse" on ereignisse;
create policy "Admins manage ereignisse"
on ereignisse for all
to authenticated
using (exists (select 1 from admins where admins.user_id = auth.uid()))
with check (exists (select 1 from admins where admins.user_id = auth.uid()));
 
-- Erzeuger duerfen nur Termine ihres EIGENEN Anbieter-Eintrags verwalten
drop policy if exists "Producers manage own ereignisse" on ereignisse;
create policy "Producers manage own ereignisse"
on ereignisse for all
to authenticated
using (exists (select 1 from anbieter a where a.id = ereignisse.anbieter_id and a.user_id = auth.uid()))
with check (exists (select 1 from anbieter a where a.id = ereignisse.anbieter_id and a.user_id = auth.uid()));
 
-- ============================================================
-- 7) DEINEN Admin-Account in die admins-Tabelle eintragen
--    (WICHTIG: sonst kannst du dich nicht mehr im Admin-Panel
--    anmelden, da die alte "jeder=Admin"-Regel jetzt weg ist!)
--
--    Ersetze 'deine-admin-email@beispiel.de' durch die E-Mail,
--    mit der du dich unter #admin einloggst.
-- ============================================================
insert into admins (user_id)
select id from auth.users where email = 'luca.fersch96@gmail.com'
on conflict (user_id) do nothing;
