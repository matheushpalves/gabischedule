#!/usr/bin/env bash
# Faz o build local e publica na VPS.
#   DEPLOY_HOST=usuario@gabischedule.duckdns.org ./deploy/deploy.sh
# O usuário remoto precisa de sudo (para gravar em /opt e /var/www e reiniciar o serviço).
set -euo pipefail

HOST="${DEPLOY_HOST:-root@gabischedule.duckdns.org}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Instalando dependências e rodando testes"
npm ci
npm test

echo "==> Build"
npm run build

echo "==> Enviando arquivos para $HOST"
ssh "$HOST" 'mkdir -p ~/gabi-upload/web ~/gabi-upload/api ~/gabi-upload/deploy'
rsync -az --delete web/dist/ "$HOST:gabi-upload/web/"
rsync -az --delete api/dist api/migrations api/package.json "$HOST:gabi-upload/api/"
rsync -az deploy/backup.sh "$HOST:gabi-upload/deploy/"

echo "==> Instalando no servidor e reiniciando"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
sudo mkdir -p /var/www/gabi /opt/gabi/api /opt/gabi/deploy
sudo rsync -a --delete ~/gabi-upload/web/ /var/www/gabi/
sudo rsync -a --delete --exclude node_modules ~/gabi-upload/api/ /opt/gabi/api/
sudo install -m 755 ~/gabi-upload/deploy/backup.sh /opt/gabi/deploy/backup.sh
cd /opt/gabi/api
sudo npm install --omit=dev --no-audit --no-fund --loglevel=error
sudo chown -R root:root /opt/gabi /var/www/gabi
sudo systemctl restart gabi-api
sleep 2
sudo systemctl --no-pager --lines=5 status gabi-api
curl -fsS http://127.0.0.1:3001/api/health && echo " API ok"
REMOTE

echo "==> Pronto: https://gabischedule.duckdns.org"
