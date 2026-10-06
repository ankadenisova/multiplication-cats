#!/usr/bin/env bash
# Parent CLI for screen-time control. Reads SCREEN_ADMIN_KEY from .env.prod next to this repo.
# Usage (G=social перед командой — группа мессенджеров, по умолчанию все приложения):
#   scripts/screen.sh status [<short name>|email]
#   scripts/screen.sh grant  masha 30            # +30 к балансу на сегодня
#   scripts/screen.sh lock   sasha  /  unlock sasha
#   scripts/screen.sh set    masha 0 30,10,10    # baseDaily rewards(1st,2nd,3rd session)
#   scripts/screen.sh device masha "iPhone Маши"  # new pairing code
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
K="${SCREEN_ADMIN_KEY:-$(grep '^SCREEN_ADMIN_KEY=' "$DIR/.env.prod" | cut -d'"' -f2)}"
BASE="${STUDY_URL:-https://study.alexpihq.com}"
GROUP="${G:-default}"
# Short names → emails live in scripts/kids.local (gitignored), lines like: masha=kid@example.com
user() {
  local f="$DIR/scripts/kids.local"
  if [ -f "$f" ]; then local e; e=$(grep -i "^${1:-}=" "$f" | head -1 | cut -d= -f2-); [ -n "$e" ] && { echo "$e"; return; }; fi
  echo "${1:-}"
}
post() { curl -s -X POST "$BASE/api/screen/admin$1" -H "x-admin-key: $K" -H 'Content-Type: application/json' -d "${2/\{/\{\"group\":\"$GROUP\",}"; echo; }
cmd="${1:-status}"; shift || true
case "$cmd" in
  status) if [ -n "${1:-}" ]; then curl -s "$BASE/api/screen/admin?user=$(user "$1")" -H "x-admin-key: $K"; else curl -s "$BASE/api/screen/admin" -H "x-admin-key: $K"; fi | python3 -m json.tool ;;
  grant)  post "" "{\"user\":\"$(user "$1")\",\"action\":\"grant\",\"minutes\":${2:-30}}" ;;
  lock)   post "" "{\"user\":\"$(user "$1")\",\"action\":\"lock\"}" ;;
  unlock) post "" "{\"user\":\"$(user "$1")\",\"action\":\"unlock\"}" ;;
  set)    post "" "{\"user\":\"$(user "$1")\",\"action\":\"set\",\"baseDailyMinutes\":$2,\"sessionRewards\":[$3]}" ;;
  device) post "/devices" "{\"user\":\"$(user "$1")\",\"name\":\"${2:-iPhone}\"}" ;;
  *) echo "unknown command: $cmd"; exit 1 ;;
esac
