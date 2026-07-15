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
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Tee all output to a persistent log on the server AND to stdout, so both the
# GitHub Actions deploy job and `tail -f ~/deploy.log` show the same thing.
exec > >(tee -a "$HOME/deploy.log") 2>&1

echo "[deploy] $(date -Is) starting..."
cd "$HOME/apps/showtime"

echo "[deploy] pulling latest image..."
docker compose pull

echo "[deploy] recreating container..."
docker compose up -d

echo "[deploy] pruning old images..."
docker image prune -f

echo "[deploy] done."
