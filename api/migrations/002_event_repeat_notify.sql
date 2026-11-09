-- Agenda: repetição e notificação antes do compromisso.
ALTER TABLE events
  ADD COLUMN repeat          text NOT NULL DEFAULT 'once',   -- once | daily | weekly | monthly | yearly
  ADD COLUMN repeat_until    date,                           -- última data possível da série (opcional)
  ADD COLUMN notify_minutes  integer,                        -- minutos antes do início; null = sem notificação
  ADD COLUMN notify_next_at  timestamptz;                    -- próximo envio da notificação (calculado pelo backend)

CREATE INDEX events_notify_due ON events (notify_next_at) WHERE notify_next_at IS NOT NULL;
