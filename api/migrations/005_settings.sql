-- Configurações do app (uma usuária só): pares chave/valor. Ex.: theme = "terracota".
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
