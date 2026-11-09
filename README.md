# Gabi

PWA pessoal de produtividade da Gabriela: **Tarefas, Agenda, Lembretes (com push), Kanban e Finanças**.

- **Frontend** (`web/`): React + Vite + TypeScript, React Router, `vite-plugin-pwa` (service worker próprio em `web/src/sw.ts`: shell offline + Web Push), dnd-kit no Kanban.
- **Backend** (`api/`): Node.js + Fastify + TypeScript, Postgres (`pg`), validação com zod, `node-cron` + `web-push` para os lembretes.
- **Compartilhado** (`shared/`): schemas zod e tipos usados pelos dois lados, formatação de BRL.
- **Deploy** (`deploy/`): Caddyfile, unidade systemd, `deploy.sh` e `backup.sh`.
- **Design** (`design/`): telas de referência (`*.dc.html`).

Interface em pt-BR, fuso `America/Sao_Paulo`, moeda BRL (valores guardados em centavos).

```
gabi/
├── shared/src/        schemas.ts (zod + tipos), format.ts (BRL, cores, repetições)
├── api/
│   ├── migrations/    SQL versionado (aplicado automaticamente ao subir)
│   ├── src/
│   │   ├── auth/      code.ts (código do dia), lockout.ts (bloqueio), store.ts, routes.ts
│   │   ├── routes/    tasks, events, reminders (+push), kanban, finance
│   │   ├── reminders/ schedule.ts (próxima ocorrência), push.ts (cron + envio)
│   │   └── index.ts   servidor
│   └── test/          testes (vitest)
├── web/src/
│   ├── pages/         Login, Tasks, Agenda, Reminders, Kanban, Finance, Notifications, Settings
│   ├── components/    Layout (barra inferior / menu lateral), Sheet, Icon, ui, InstallBanner
│   ├── lib/           api, date (fuso SP), hooks, pwa (instalação + push)
│   └── sw.ts          service worker
└── deploy/            Caddyfile, gabi-api.service, deploy.sh, backup.sh
```

## Rodando localmente

Requisitos: Node 20+ (testado com 22) e Postgres 14+.

```bash
npm install
```

```bash
createuser gabi --pwprompt && createdb gabi -O gabi   # ou via psql
```

```bash
cp api/.env.example api/.env   # ajuste DATABASE_URL, AUTH_BASE e COOKIE_SECURE=false
```

```bash
npm run dev:api    # http://127.0.0.1:3001 (aplica as migrações ao subir)
```

```bash
npm run dev:web    # http://localhost:5173 (faz proxy de /api para a API)
```

Outros comandos (na raiz):

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes da API (autenticação, bloqueio, fuso, agendamento de lembretes) |
| `npm run lint` | ESLint + `tsc --noEmit` em shared, api e web |
| `npm run build` | Build da API (`api/dist`) e do PWA (`web/dist`) |
| `npm run vapid -w api` | Gera um par de chaves VAPID para o `.env` |
| `npm run icons -w web` | Regera os ícones PNG (precisa do Playwright) |

> Em `http://localhost` o Chrome aceita cookie `Secure`; no Safari use `COOKIE_SECURE=false` no `.env` de desenvolvimento.

## Autenticação

- Login por teclado numérico. Código válido = `AUTH_BASE` + dia do mês em São Paulo (ex.: base 1828, dia 09 → `1837`).
- `AUTH_BASE` existe **só** no `.env` do servidor; o frontend nunca conhece a regra. Erro sempre como “Código incorreto”.
- Até 00:05 o código do dia anterior também vale (tolerância da virada).
- Comparação em tempo constante (`timingSafeEqual` sobre SHA-256, testando todos os candidatos).
- Sessão: token aleatório de 256 bits em cookie `httpOnly`, `Secure`, `SameSite=Strict`, 30 dias; no banco só fica o hash. “Sair” revoga a sessão.
- Todas as rotas `/api/*` exigem sessão, exceto `POST /api/auth/login` (e `/api/health`).
- 5 erros seguidos por IP → bloqueio de 15 minutos (HTTP 429). Tentativas ficam em `login_attempts`. O IP real vem do `X-Forwarded-For` definido pelo Caddy (só proxies em `TRUST_PROXY` são confiáveis).

## API (resumo)

| Rota | Métodos |
| --- | --- |
| `/api/auth/login` · `/logout` · `/me` | POST · POST · GET |
| `/api/task-categories[/:id]` | GET, POST, PUT, DELETE |
| `/api/tasks[/:id]` | GET, POST, PATCH, DELETE |
| `/api/events?from=&to=` (repetições expandidas) · `/api/events/:id` | GET, POST, PATCH, DELETE |
| `/api/reminders[/:id]` | GET, POST, PATCH, DELETE |
| `/api/push/config` · `/subscribe` · `/unsubscribe` · `/test` | GET · POST · POST · POST |
| `/api/boards[/:id]` | GET, POST, PUT, DELETE |
| `/api/cards?boardId=` · `/api/cards/:id` · `/api/cards/:id/move` | GET, POST, PATCH, DELETE · POST |
| `/api/finance/categories[/:id]` | GET, POST, PUT, DELETE |
| `/api/finance/transactions?month=` · `/:id` | GET, POST, PATCH, DELETE |
| `/api/finance/summary?month=YYYY-MM` | GET |
| `/api/finance/goals[/:id]` | GET, POST, PUT, DELETE |

## Lembretes e notificações

- **Agenda:** compromissos podem repetir (todo dia, toda semana, todo mês, todo ano, com “repetir até” opcional), atravessar a meia-noite (fim antes do início = termina no dia seguinte) e ter notificação antes do início (na hora, 5/15/30 min, 1/2 horas ou 1 dia antes). A API devolve as repetições já expandidas para o intervalo pedido; editar/excluir vale para a série inteira.

- O backend calcula `next_at` (próximo disparo) no fuso de São Paulo; um `node-cron` roda a cada minuto, envia Web Push para todos os aparelhos inscritos e agenda a próxima ocorrência (“uma vez” é desativado depois de disparar). Inscrições expiradas (404/410) são removidas.
- **iPhone/iPad:** push só funciona com o app **instalado na Tela de Início** (iOS 16.4+). A tela *Lembretes → Ativar notificações* explica o passo a passo e só habilita o botão quando o app está instalado.

## Deploy na VPS (Ubuntu, Hostinger)

Domínio: `gabischedule.duckdns.org` (já apontando para a VPS). Portas **80 e 443** precisam estar abertas para o Caddy emitir o certificado.

### 1. Preparar o servidor (uma vez)

```bash
sudo apt update && sudo apt install -y postgresql rsync curl debian-keyring debian-archive-keyring apt-transport-https
```

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Banco, usuário de sistema e pastas:

```bash
sudo -u postgres psql -c "CREATE USER gabi WITH PASSWORD 'TROQUE_ESTA_SENHA';" -c "CREATE DATABASE gabi OWNER gabi;"
```

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin gabi
sudo mkdir -p /etc/gabi /opt/gabi /var/www/gabi
```

Configuração (fora do repositório):

```bash
sudo cp api/.env.example /etc/gabi/api.env   # ou crie o arquivo na mão
sudo nano /etc/gabi/api.env                  # DATABASE_URL, AUTH_BASE, VAPID_*, VAPID_SUBJECT
sudo chown root:gabi /etc/gabi/api.env && sudo chmod 640 /etc/gabi/api.env
```

Serviço e Caddy:

```bash
sudo cp deploy/gabi-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable gabi-api
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Backup diário (03:15), mantendo os 14 mais recentes em `/var/backups/gabi`:

```bash
echo '15 3 * * * root /opt/gabi/deploy/backup.sh >> /var/log/gabi-backup.log 2>&1' | sudo tee /etc/cron.d/gabi-backup
```

### 2. Publicar (sempre que mudar algo)

Na sua máquina, com acesso SSH à VPS:

```bash
DEPLOY_HOST=root@gabischedule.duckdns.org ./deploy/deploy.sh
```

O script roda os testes, faz o build, envia `web/dist` para `/var/www/gabi` e a API para `/opt/gabi/api` via `rsync`, instala as dependências de produção e reinicia o `gabi-api`. As migrações do banco rodam automaticamente quando a API sobe.

Restaurar um backup:

```bash
sudo -u postgres pg_restore --clean --if-exists -d gabi /var/backups/gabi/gabi-AAAAMMDD-HHMM.dump
```

## CI/CD (GitHub Actions)

O workflow `.github/workflows/ci-cd.yml` tem dois jobs:

- **CI**: roda em todo push e em PRs para o `main`: `npm ci`, lint, testes e build. Depois sobe a API contra um Postgres de verdade (migrações, rota protegida responde 401, login e sessão funcionando). Também confere que `AUTH_BASE` não aparece no bundle do frontend.
- **Deploy**: roda só em push no `main` (ou manualmente em *Actions → CI/CD → Run workflow* com o `main` selecionado), depois que o CI passa. Ele usa o build gerado pelo CI e roda `deploy/deploy.sh` com `SKIP_BUILD=1`. No fim, testa `https://gabischedule.duckdns.org/api/health`.

### Configuração (uma vez)

1. Gere uma chave só para o deploy, na sua máquina:

```bash
ssh-keygen -t ed25519 -C "gabi-deploy" -f gabi-deploy -N ""
```

2. Autorize a chave na VPS (usuário com sudo sem senha; o `root` serve):

```bash
ssh-copy-id -i gabi-deploy.pub root@gabischedule.duckdns.org
```

3. Pegue a impressão digital do servidor (vai no secret `VPS_KNOWN_HOSTS`):

```bash
ssh-keyscan -t ed25519 gabischedule.duckdns.org
```

4. No GitHub: *Settings → Environments → New environment* chamado **`production`**. Dentro dele, cadastre os secrets:

| Secret | Valor |
| --- | --- |
| `VPS_SSH_KEY` | conteúdo do arquivo `gabi-deploy` (a chave **privada**) |
| `VPS_KNOWN_HOSTS` | a saída do `ssh-keyscan` acima |
| `VPS_HOST` | `root@gabischedule.duckdns.org` |

Em *Environments → production* também dá para exigir aprovação manual antes de cada deploy (*Required reviewers*), se preferir.

5. A VPS precisa ter passado pela preparação da seção “Deploy na VPS” (Node, Postgres, Caddy, `/etc/gabi/api.env`, serviço systemd).
