-- Agenda: várias notificações por compromisso (ex.: 1 dia antes e 1 hora antes).
ALTER TABLE events ADD COLUMN notify_list integer[] NOT NULL DEFAULT '{}';
UPDATE events SET notify_list = ARRAY[notify_minutes] WHERE notify_minutes IS NOT NULL;
ALTER TABLE events DROP COLUMN notify_minutes;
ALTER TABLE events RENAME COLUMN notify_list TO notify_minutes;
