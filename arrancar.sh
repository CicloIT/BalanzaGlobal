#!/usr/bin/env bash
# Levanta PostgreSQL y el backend (pm2) después de reiniciar el container. Se puede correr las veces que sea.
# Uso: cd /root/BalanzaGlobal && ./arrancar.sh
set -e
cd "$(dirname "$0")"

# 1. PostgreSQL
if ! pg_isready -q -h 127.0.0.1; then
  echo "▶ Iniciando PostgreSQL..."
  service postgresql start >/dev/null 2>&1 || pg_ctlcluster "$(ls /etc/postgresql | sort -V | tail -1)" main start
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 && break; sleep 1; done
fi
pg_isready -h 127.0.0.1 || { echo "❌ PostgreSQL no responde"; exit 1; }

# 2. pm2
command -v pm2 >/dev/null || npm install -g pm2
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save >/dev/null

# 3. Verificación
PORT=$(grep -E '^PORT=' Backend/.env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
sleep 3
pm2 status balanza
curl -s -o /dev/null -w "Backend: HTTP %{http_code}\n" "http://127.0.0.1:${PORT:-3000}/" || echo "⚠ El backend no responde todavía: pm2 logs balanza"
