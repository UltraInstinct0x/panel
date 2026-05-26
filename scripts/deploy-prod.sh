#!/usr/bin/env bash
# scripts/deploy-prod.sh — invoked by .github/workflows/deploy.yml on the self-hosted runner.
# runs as user `ubuntu` on the panel.goku.codes oracle box.
set -euo pipefail

cd "$HOME/panel"

echo "==> sha $(git rev-parse --short HEAD)"

echo "==> install"
# nvm path for non-interactive shells
export PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile=false

echo "==> build"
pnpm build

echo "==> restart panel.service"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user restart panel
sleep 3
systemctl --user is-active panel

echo "==> health"
for i in 1 2 3 4 5; do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://panel.goku.codes/api/health || echo 000)
  if [ "$code" = "200" ]; then
    echo "health ok"
    exit 0
  fi
  echo "  attempt $i: http $code, retrying..."
  sleep 3
done
echo "health check failed"
exit 1
