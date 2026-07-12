-- ============================================================
-- RegioMap: Verbindlichkeitsstufen fuer Termin-Anmeldungen
-- ============================================================

-- 1) Neue Spalte am Termin: welche Verbindlichkeitsstufe der
--    Erzeuger fuer diesen Termin gewaehlt hat
alter table ereignisse add column if not exists verbindlichkeit text default 'locker';

-- 2) Neue Spalten bei den Anmeldungen: Adresse (nur bei "streng"
--    Pflicht) und die Bestaetigungs-Checkbox
alter table anmeldungen add column if not exists adresse text;
alter table anmeldungen add column if not exists verbindlich_bestaetigt boolean default false;

-- Fertig - keine weiteren Schritte noetig. Bestehende Termine
-- bekommen automatisch die Stufe 'locker' (wie bisher).