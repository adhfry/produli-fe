#!/usr/bin/env bash
#
# KHUSUS branch `dev`/lingkungan simulasi -- deploy dev.produli.labkesdasumenep.id.
# Port BERBEDA dari produksi (default 3001, produksi biasanya 3000) supaya kedua proses
# bisa jalan berdampingan tanpa bentrok. Proses manager: SATU dari PM2/systemd,
# ikuti yang SUDAH dipakai di VPS untuk produksi (docs/planning/13) -- JANGAN campur
# dua-duanya. Default di bawah pakai PM2; ganti PROCESS_MANAGER=systemd kalau VPS
# pakai systemd untuk produksi.
#
# Pemakaian:
#   scripts/dev-deploy.sh
#   PROCESS_MANAGER=systemd scripts/dev-deploy.sh
#   PORT=3005 scripts/dev-deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env belum ada -- salin dari .env.example, isi NUXT_PUBLIC_API_BASE ke https://dev.api.produli.labkesdasumenep.id/api/v1, NUXT_PUBLIC_SITE_URL ke https://dev.produli.labkesdasumenep.id, dan NUXT_PUBLIC_APP_ENV_LABEL=SIMULASI." >&2
  exit 1
fi

PORT="${PORT:-3001}"
PROCESS_MANAGER="${PROCESS_MANAGER:-pm2}"
APP_NAME="produli-frontend-dev"

echo "== 1/3: git pull =="
git fetch origin
git checkout dev
git pull origin dev

echo "== 2/3: npm ci + build =="
npm ci
npm run build

echo "== 3/3: restart proses (port $PORT, via $PROCESS_MANAGER) =="
if [ "$PROCESS_MANAGER" = "pm2" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME"
    else
      PORT="$PORT" pm2 start .output/server/index.mjs --name "$APP_NAME"
    fi
    pm2 save
  else
    echo "ERROR: pm2 tidak ditemukan. Set PROCESS_MANAGER=systemd kalau VPS pakai systemd." >&2
    exit 1
  fi
elif [ "$PROCESS_MANAGER" = "systemd" ]; then
  if systemctl list-unit-files | grep -q "${APP_NAME}.service"; then
    sudo systemctl restart "${APP_NAME}.service"
  else
    echo "ERROR: ${APP_NAME}.service belum terpasang -- lihat docs/planning/14-setup-dev-simulasi-vps.md (produli-backend-dev repo) untuk template unit systemd." >&2
    exit 1
  fi
else
  echo "ERROR: PROCESS_MANAGER='$PROCESS_MANAGER' tidak dikenal -- pakai 'pm2' atau 'systemd'." >&2
  exit 1
fi

echo ""
echo "=== Selesai. Cek https://dev.produli.labkesdasumenep.id (pastikan nginx sudah proxy ke port $PORT). ==="
