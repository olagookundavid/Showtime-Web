#!/usr/bin/env bash
#
# Server-side deploy script for the Showtime backend.
#
# This is the SOURCE-CONTROLLED COPY (for history / review). The copy that
# ACTUALLY RUNS lives on the server at ~/scripts/deploy.sh and is invoked by the
# SSH forced command in the deploy key's ~/.ssh/authorized_keys entry (see
# .github/workflows/deploy-backend.yml -> deploy job).
#
# The two copies are NOT auto-synced. If you edit this file, update the server
# copy too:  cat this file into ~/scripts/deploy.sh on the server.
#
# Safety model: a new image is only kept if it actually becomes healthy
# (Docker's own HEALTHCHECK, defined in the Dockerfile). If it doesn't, this
# script captures the failing container's own logs (before it's replaced),
# rolls back to the image that was running before this deploy started, emails
# an alert with those logs attached, and exits non-zero (so the CI "deploy"
# job shows red). A successful deploy also emails, with the exact commit and
# build time that shipped (read from OCI labels CI stamps on every image).
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

exec > >(tee -a "$HOME/deploy.log") 2>&1

cd "$HOME/apps/showtime"

echo "[deploy] $(date -Is) starting..."

# Capture what's running RIGHT NOW, before pulling anything new — this is
# the rollback target if the new image fails its health check.
PREVIOUS_IMAGE_ID="$(docker compose images -q backend 2>/dev/null || true)"

echo "[deploy] pulling latest image..."
if ! docker compose pull; then
  echo "[deploy] FAILED — could not pull new image. Nothing changed."
  NOW_HUMAN="$(date '+%Y-%m-%d %H:%M:%S %Z')"
  BODY="$(cat <<EOF
Showtime Backend — Deployment Failed

App:         showtime-backend
Server:      $(hostname)
Failed At:   ${NOW_HUMAN}
Stage:       Image pull
Reason:      docker compose pull failed. No container was touched — current deployment is unaffected.
EOF
)"
  if "$HOME/scripts/alert.sh" "[Showtime] DEPLOY FAILED on $(hostname)" "$BODY"; then
    echo "[deploy] failure alert sent."
  else
    echo "[deploy] WARNING: failure alert email FAILED TO SEND."
  fi
  exit 1
fi

echo "[deploy] recreating container..."
docker compose up -d

echo "[deploy] waiting for the new container to report healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=20   # ~100s total: matches the Dockerfile's start_period + retries
STATUS="starting"
while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' showtime-backend 2>/dev/null || echo "unknown")"
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  if [ "$STATUS" = "unhealthy" ]; then
    break
  fi
  sleep 5
  ATTEMPTS=$((ATTEMPTS + 1))
done

if [ "$STATUS" != "healthy" ]; then
  echo "[deploy] FAILED — new backend never became healthy (status: $STATUS)"

  # Capture the failing container's own logs BEFORE it gets replaced during
  # rollback below — this is the only chance to see why it crashed.
  CRASH_LOGS="$(docker logs --tail 50 showtime-backend 2>&1)"
  NOW_HUMAN="$(date '+%Y-%m-%d %H:%M:%S %Z')"

  ROLLBACK_LINE="No previous image captured — manual rollback required"
  [ -n "$PREVIOUS_IMAGE_ID" ] && ROLLBACK_LINE="Rolling back to previous image (${PREVIOUS_IMAGE_ID:0:12})"

  BODY="$(cat <<EOF
Showtime Backend — Deployment Failed

App:         showtime-backend
Server:      $(hostname)
Failed At:   ${NOW_HUMAN}
Status:      ${STATUS}
Action:      ${ROLLBACK_LINE}

--- Container Logs (last 50 lines) ---
${CRASH_LOGS}
EOF
)"
  if "$HOME/scripts/alert.sh" "[Showtime] DEPLOY FAILED on $(hostname)" "$BODY"; then
    echo "[deploy] failure alert (with crash logs) sent."
  else
    echo "[deploy] WARNING: failure alert email FAILED TO SEND — check Resend/RESEND_API_KEY manually."
  fi

  if [ -n "$PREVIOUS_IMAGE_ID" ]; then
    echo "[deploy] rolling back to previous image ($PREVIOUS_IMAGE_ID)..."
    docker tag "$PREVIOUS_IMAGE_ID" ghcr.io/olagookundavid/showtime-backend:latest
    docker compose up -d
    echo "[deploy] rollback applied. Investigate before deploying again."
  fi
  exit 1
fi

echo "[deploy] backend is healthy ✅"

# Docker's metadata-action stamps every image built by CI with OCI labels —
# the exact git commit and build time — so the success email can say WHAT
# shipped, not just THAT something shipped.
COMMIT_SHA="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' showtime-backend 2>/dev/null)"
BUILD_TIME="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.created"}}' showtime-backend 2>/dev/null)"
[ -z "$COMMIT_SHA" ] && COMMIT_SHA="unknown"
[ -z "$BUILD_TIME" ] && BUILD_TIME="unknown"

BUILD_TIME_HUMAN="$(date -d "$BUILD_TIME" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null)"
[ -z "$BUILD_TIME_HUMAN" ] && BUILD_TIME_HUMAN="$BUILD_TIME"

if [ "$COMMIT_SHA" != "unknown" ]; then
  COMMIT_LINE="${COMMIT_SHA:0:7}"
  COMMIT_URL_LINE="https://github.com/olagookundavid/Showtime-Web/commit/${COMMIT_SHA}"
else
  COMMIT_LINE="unknown"
  COMMIT_URL_LINE="n/a (image built outside the standard CI pipeline?)"
fi

NOW_HUMAN="$(date '+%Y-%m-%d %H:%M:%S %Z')"

BODY="$(cat <<EOF
Showtime Backend — Deployment Successful

App:         showtime-backend
Server:      $(hostname)
Deployed At: ${NOW_HUMAN}

Commit:      ${COMMIT_LINE}
Commit URL:  ${COMMIT_URL_LINE}
Image Built: ${BUILD_TIME_HUMAN}
EOF
)"

if "$HOME/scripts/alert.sh" "[Showtime] Deploy succeeded on $(hostname)" "$BODY"; then
  echo "[deploy] success alert sent."
else
  echo "[deploy] WARNING: success alert email FAILED TO SEND."
fi

echo "[deploy] pruning old images..."
docker image prune -f

echo "[deploy] done."
