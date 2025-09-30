#!/bin/bash
# Build and push the backend Docker image to the registry (GHCR by default)
# Usage:
#   ./up-build-backend.sh                 # builds with timestamp tag and pushes
#   ./up-build-backend.sh <tag>           # builds with provided tag and pushes
# Env overrides (optional):
#   IMAGE_REPO     - default: ghcr.io/rybbit-io/rybbit-backend
#   UPDATE_ENV     - if set to 1, will update .env IMAGE_TAG to the new tag
#   ALSO_TAG_LATEST- if set to 1, also tag and push :latest (use with care)
set -euo pipefail

IMAGE_REPO=${IMAGE_REPO:-ghcr.io/rybbit-io/rybbit-backend}
TAG=${1:-$(date +%Y%m%d%H%M)}
ALSO_TAG_LATEST=${ALSO_TAG_LATEST:-0}
UPDATE_ENV=${UPDATE_ENV:-1}

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH." >&2
  exit 1
fi

# Helpful hint about auth
if ! docker info 2>/dev/null | grep -qi 'Username:'; then
  echo "Note: make sure you're logged in to your registry (e.g., docker login ghcr.io) before pushing." >&2
fi

echo "➡️ Building backend image: ${IMAGE_REPO}:${TAG}"
docker build \
  -f server/Dockerfile \
  -t "${IMAGE_REPO}:${TAG}" \
  .

echo "⬆️ Pushing image: ${IMAGE_REPO}:${TAG}"
docker push "${IMAGE_REPO}:${TAG}"

if [ "${ALSO_TAG_LATEST}" = "1" ]; then
  echo "🔁 Tagging also as :latest and pushing"
  docker tag "${IMAGE_REPO}:${TAG}" "${IMAGE_REPO}:latest"
#  docker push "${IMAGE_REPO}:latest"
fi

# Optionally update .env with the new IMAGE_TAG so compose will pull the new one next time
if [ "${UPDATE_ENV}" = "1" ]; then
  if [ -f .env ]; then
    echo "📝 Updating .env IMAGE_TAG=${TAG} (backup at .env.bak)"
    cp .env .env.bak
    if grep -q '^IMAGE_TAG=' .env; then
      # Replace existing line
      sed -i.bak2 "s/^IMAGE_TAG=.*/IMAGE_TAG=${TAG}/" .env && rm -f .env.bak2 || true
    else
      # Append if not present
      echo "IMAGE_TAG=${TAG}" >> .env
    fi
  else
    echo "ℹ️ .env not found; skipping IMAGE_TAG update. You can set it manually: IMAGE_TAG=${TAG}"
  fi
fi

cat <<EOF
✅ Done.

Image: ${IMAGE_REPO}:${TAG}

Next steps:
  # On your server/host where docker-compose runs:
  IMAGE_TAG=${TAG} docker compose pull backend
  IMAGE_TAG=${TAG} docker compose up -d backend

Or, since .env was updated (if present), simply run:
  docker compose pull backend && docker compose up -d backend
EOF
