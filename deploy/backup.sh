#!/usr/bin/env bash
# Backup diário do Postgres (pg_dump, formato custom), mantendo os 14 mais recentes.
# Cron (como root):  15 3 * * * /opt/gabi/deploy/backup.sh >> /var/log/gabi-backup.log 2>&1
# Restaurar:          pg_restore --clean --if-exists -d "$DATABASE_URL" /var/backups/gabi/gabi-AAAAMMDD-HHMM.dump
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/gabi/api.env}"
DEST="${BACKUP_DIR:-/var/backups/gabi}"
KEEP="${KEEP:-14}"

# Lê só o DATABASE_URL do .env (sem executar o arquivo).
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL não encontrado em $ENV_FILE" >&2; exit 1; }

mkdir -p "$DEST"
chmod 700 "$DEST"
FILE="$DEST/gabi-$(date +%Y%m%d-%H%M).dump"
pg_dump --format=custom --no-owner --file="$FILE.tmp" "$DATABASE_URL"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
echo "$(date -Is) backup criado: $FILE ($(du -h "$FILE" | cut -f1))"

# Mantém só os $KEEP mais recentes.
ls -1t "$DEST"/gabi-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
