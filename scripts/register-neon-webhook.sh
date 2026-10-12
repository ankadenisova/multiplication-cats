#!/usr/bin/env bash
# Registers the Resend-backed email webhook with Neon Auth. Run once RESEND_API_KEY is set in prod .env.
# Usage: NEON_API_KEY=napi_... NEON_PROJECT_ID=... NEON_BRANCH_ID=... ./scripts/register-neon-webhook.sh https://your-domain.example
# Project and branch ids are in the Neon console (Settings → General / Branches).
set -euo pipefail
APP_URL="${1:?app url}"
PROJECT="${NEON_PROJECT_ID:?neon project id}"
BRANCH="${NEON_BRANCH_ID:?neon branch id}"
curl -s -X PUT "https://console.neon.tech/api/v2/projects/$PROJECT/branches/$BRANCH/auth/webhooks" \
  -H "Authorization: Bearer ${NEON_API_KEY:?}" -H "Content-Type: application/json" \
  -d "{\"enabled\":true,\"webhook_url\":\"$APP_URL/api/webhooks/neon\",\"enabled_events\":[\"send.magic_link\",\"send.otp\"],\"timeout_seconds\":8}"
echo
