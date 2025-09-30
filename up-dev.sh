#!/bin/bash
# Start the stack in DEVELOPMENT mode (client runs `npm run dev` with live reload)
# Usage: ./up-dev.sh
set -euo pipefail

if [ ! -f .env ]; then
  echo "Error: .env file not found. Please run ./setup.sh first."
  exit 1
fi

source .env

# Preflight: if a container named "backend" already exists (possibly from a previous run),
# stop and remove it to avoid host port conflicts (e.g., 3001 already in use).
if docker ps -a --format '{{.Names}}' | grep -q '^backend$'; then
  echo "[dev] Found existing 'backend' container. Stopping and removing to avoid port conflicts..."
  docker stop backend >/dev/null 2>&1 || true
  docker rm backend >/dev/null 2>&1 || true
fi

echo "[dev] Building and starting services using docker-compose.yml + docker-compose.override.yml..."
# Default docker compose automatically loads docker-compose.override.yml
# which switches the client to the dev Dockerfile and mounts the source.
docker compose up -d --build

echo "[dev] Services are up. Useful commands:"
echo "  docker compose ps"
echo "  docker compose logs -f backend"
echo "  docker compose logs -f client"
echo "  docker compose down"