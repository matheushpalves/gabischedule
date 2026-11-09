-- Lembretes: "Feito". Cada conclusão marca UMA ocorrência (para repetidos, a do dia/horário).
CREATE TABLE reminder_completions (
  id             bigserial PRIMARY KEY,
  reminder_id    integer NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  occurrence_at  timestamptz NOT NULL,          -- qual ocorrência foi concluída
  done_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, occurrence_at)
);
CREATE INDEX reminder_completions_done ON reminder_completions (done_at DESC);
