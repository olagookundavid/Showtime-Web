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
# script rolls back to the image that was running before this deploy started,
# alerts, and exits non-zero (so the CI "deploy" job shows red).
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
  "$HOME/scripts/alert.sh" "[Showtime] DEPLOY FAILED on $(hostname)" \
    "docker compose pull failed at $(date -Is). No container was touched."
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
  "$HOME/scripts/alert.sh" "[Showtime] DEPLOY FAILED on $(hostname)" \
    "New backend image failed its healthcheck (status: $STATUS) at $(date -Is). $( [ -n "$PREVIOUS_IMAGE_ID" ] && echo "Rolling back to the previous image." || echo "No previous image ID captured — manual rollback needed." ) Check: docker compose -f ~/apps/showtime/docker-compose.yml logs backend"

  if [ -n "$PREVIOUS_IMAGE_ID" ]; then
    echo "[deploy] rolling back to previous image ($PREVIOUS_IMAGE_ID)..."
    docker tag "$PREVIOUS_IMAGE_ID" ghcr.io/olagookundavid/showtime-backend:latest
    docker compose up -d
    echo "[deploy] rollback applied. Investigate before deploying again."
  fi
  exit 1
fi

echo "[deploy] backend is healthy ✅"

echo "[deploy] pruning old images..."
docker image prune -f

echo "[deploy] done."
