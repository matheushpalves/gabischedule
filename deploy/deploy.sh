#!/usr/bin/env bash
# Faz o build e publica o Gabi.
#   Na própria VPS (repositório em /root/gabischedule):  ./deploy/deploy.sh
#   De outra máquina, via SSH:  DEPLOY_HOST=root@gabischedule.duckdns.org ./deploy/deploy.sh
#   No GitHub Actions (.github/workflows/ci-cd.yml): SKIP_BUILD=1 + DEPLOY_HOST.
# O usuário (local ou remoto) precisa de sudo para gravar em /opt e /var/www e reiniciar o serviço.
#
# Destinos no servidor:
#   frontend → /var/www/gabi/public   (raiz do nginx; nunca coloque o repositório aqui)
#   API      → /opt/gabi/api          (serviço systemd gabi-api; porta definida em /etc/gabi/api.env)
set -euo pipefail

HOST="${DEPLOY_HOST:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Instalando dependências e rodando testes"
  npm ci
  npm test

  echo "==> Build"
  npm run build
fi
for f in web/dist/index.html api/dist/index.js; do
  [ -f "$f" ] || { echo "Faltando $f — rode o build antes." >&2; exit 1; }
done

# Instala a partir de uma pasta ($1) com web/, api/ e deploy/. Roda no servidor.
INSTALL='
set -euo pipefail
SRC="$1"
sudo mkdir -p /var/www/gabi/public /opt/gabi/api /opt/gabi/deploy
sudo rsync -a --delete "$SRC/web/" /var/www/gabi/public/
sudo rsync -a --delete --exclude node_modules "$SRC/api/" /opt/gabi/api/
sudo install -m 755 "$SRC/deploy/backup.sh" /opt/gabi/deploy/backup.sh
cd /opt/gabi/api
# As devDependencies incluem o workspace @gabi/shared, que não existe no registro do npm
# (ele já vai embutido no build), então são removidas antes de instalar.
sudo npm pkg delete devDependencies
sudo npm install --omit=dev --no-audit --no-fund --loglevel=error
sudo chown -R root:root /opt/gabi /var/www/gabi/public
sudo systemctl restart gabi-api
PORT="$(sudo grep -E "^PORT=" /etc/gabi/api.env 2>/dev/null | cut -d= -f2 || true)"
PORT="${PORT:-3011}"
for i in $(seq 1 15); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
sudo systemctl --no-pager --lines=5 status gabi-api
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo " API ok (porta $PORT)"
'

if [ -z "$HOST" ]; then
  echo "==> Instalando nesta máquina"
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  mkdir -p "$STAGE/web" "$STAGE/api" "$STAGE/deploy"
  rsync -a web/dist/ "$STAGE/web/"
  rsync -a api/dist api/migrations api/package.json "$STAGE/api/"
  cp deploy/backup.sh "$STAGE/deploy/"
  bash -c "$INSTALL" _ "$STAGE"
else
  echo "==> Enviando arquivos para $HOST"
  ssh "$HOST" 'mkdir -p ~/gabi-upload/web ~/gabi-upload/api ~/gabi-upload/deploy'
  rsync -az --delete web/dist/ "$HOST:gabi-upload/web/"
  rsync -az --delete api/dist api/migrations api/package.json "$HOST:gabi-upload/api/"
  rsync -az deploy/backup.sh "$HOST:gabi-upload/deploy/"
  echo "==> Instalando no servidor e reiniciando"
  ssh "$HOST" "bash -s -- \$HOME/gabi-upload" <<<"$INSTALL"
fi

echo "==> Pronto: https://gabischedule.duckdns.org"
