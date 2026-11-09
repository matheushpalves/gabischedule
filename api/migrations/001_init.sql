-- Esquema inicial do Gabi.
-- Datas de calendário (date) e horas (text HH:MM) estão no fuso America/Sao_Paulo.

CREATE TABLE sessions (
  id          bigserial PRIMARY KEY,
  token_hash  text NOT NULL UNIQUE,            -- sha256 do token do cookie (o token em si nunca é salvo)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE TABLE login_attempts (
  id          bigserial PRIMARY KEY,
  ip          text NOT NULL,
  success     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_ip_time ON login_attempts (ip, created_at DESC);

CREATE TABLE task_categories (
  id     serial PRIMARY KEY,
  name   text NOT NULL UNIQUE,
  color  text NOT NULL
);
INSERT INTO task_categories (name, color) VALUES
  ('Casa', 'rosa'), ('Trabalho', 'lilas'), ('Bem-estar', 'verde'), ('Pessoal', 'pessego');

CREATE TABLE tasks (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  notes        text,
  category_id  integer REFERENCES task_categories(id) ON DELETE SET NULL,
  due_date     date,
  due_time     text,
  done         boolean NOT NULL DEFAULT false,
  done_date    date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  place       text NOT NULL DEFAULT '',
  date        date NOT NULL,
  start_time  text NOT NULL,
  end_time    text NOT NULL,
  color       text NOT NULL DEFAULT 'rosa'
);
CREATE INDEX events_date ON events (date);

CREATE TABLE reminders (
  id              serial PRIMARY KEY,
  title           text NOT NULL,
  date            date NOT NULL,
  time            text NOT NULL,
  repeat          text NOT NULL,
  interval_hours  integer,
  active          boolean NOT NULL DEFAULT true,
  next_at         timestamptz,
  last_sent_at    timestamptz
);
CREATE INDEX reminders_due ON reminders (next_at) WHERE active;

CREATE TABLE push_subscriptions (
  id          serial PRIMARY KEY,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE boards (
  id    serial PRIMARY KEY,
  name  text NOT NULL
);
INSERT INTO boards (name) VALUES ('Casa nova');

CREATE TABLE cards (
  id        serial PRIMARY KEY,
  board_id  integer NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  col       smallint NOT NULL CHECK (col BETWEEN 0 AND 2),
  position  integer NOT NULL,
  title     text NOT NULL,
  tag       text NOT NULL DEFAULT '',
  color     text NOT NULL DEFAULT 'rosa',
  due_date  date
);
CREATE INDEX cards_board ON cards (board_id, col, position);

CREATE TABLE fin_categories (
  id           serial PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  color        text NOT NULL,
  limit_cents  integer
);
INSERT INTO fin_categories (name, color, limit_cents) VALUES
  ('Renda', 'verde', NULL), ('Mercado', 'pessego', 90000), ('Beleza', 'rosa', 20000),
  ('Lazer', 'lilas', 40000), ('Casa', 'azul', 60000);

CREATE TABLE transactions (
  id            serial PRIMARY KEY,
  title         text NOT NULL,
  type          text NOT NULL CHECK (type IN ('in', 'out')),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  category_id   integer REFERENCES fin_categories(id) ON DELETE SET NULL,
  date          date NOT NULL
);
CREATE INDEX transactions_date ON transactions (date);

CREATE TABLE goals (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  saved_cents   integer NOT NULL DEFAULT 0,
  target_cents  integer NOT NULL
);
