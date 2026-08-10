#!/usr/bin/env bash
#
# Sends an ops alert email via Resend. Used by deploy.sh, pg-backup.sh, and
# disk-check.sh.
#
# This is the SOURCE-CONTROLLED COPY (for history / review). The copy that
# ACTUALLY RUNS lives on the server at ~/scripts/alert.sh. The two copies are
# NOT auto-synced — update both if you change this.
#
# Usage: alert.sh "subject" "body"
#
# Checks Resend's actual HTTP response status rather than trusting curl's own
# exit code — curl only fails on connection-level errors (DNS, timeout), not
# on HTTP error responses (401, 403, etc.), so without this check a rejected
# request would look identical to a successfully sent one to any caller.
set -uo pipefail
SUBJECT="${1:-Showtime alert}"
BODY="${2:-}"
TO="david@fusewall.africa"
FROM="Showtime Alerts <showtime@sffl.football>"
RESEND_API_KEY="$(grep -E '^RESEND_API_KEY=' "$HOME/apps/showtime/.env" | cut -d= -f2-)"

if [ -z "$RESEND_API_KEY" ]; then
  echo "[alert.sh] ERROR: RESEND_API_KEY missing from ~/apps/showtime/.env — could not send: $SUBJECT" >&2
  exit 1
fi

BODY_JSON=$(jq -n --arg from "$FROM" --arg to "$TO" --arg subject "$SUBJECT" --arg text "$BODY" \
  '{from:$from, to:[$to], subject:$subject, text:$text}')

HTTP_CODE="$(curl -sS -o /tmp/alert-last-response.json -w '%{http_code}' -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  --data "$BODY_JSON")"

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[alert.sh] sent OK: $SUBJECT"
  exit 0
else
  echo "[alert.sh] ERROR: Resend returned HTTP $HTTP_CODE for: $SUBJECT" >&2
  cat /tmp/alert-last-response.json >&2
  exit 1
fi
