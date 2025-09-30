#!/bin/bash
# Start the stack in PRODUCTION mode (builds optimized Next.js client and runs without dev override)
# Usage: ./up-prod.sh
set -euo pipefail

if [ ! -f .env ]; then
  echo "Error: .env file not found. Please run ./setup.sh first."
  exit 1
fi

source .env

# Preflight: if a container named "backend" already exists (possibly from a previous run),
# stop and remove it to avoid host port conflicts (e.g., 3001 already in use).
if docker ps -a --format '{{.Names}}' | grep -q '^backend$'; then
  echo "[prod] Found existing 'backend' container. Stopping and removing to avoid port conflicts..."
  docker stop backend >/dev/null 2>&1 || true
  docker rm backend >/dev/null 2>&1 || true
fi

echo "[prod] Building and starting services using docker-compose.yml only..."
# Use only the base compose file to avoid docker-compose.override.yml (dev settings)
docker compose -f docker-compose.yml up -d --build

echo "[prod] Services are up. Useful commands:"
echo "  docker compose -f docker-compose.yml ps"
echo "  docker compose -f docker-compose.yml logs -f backend"
echo "  docker compose -f docker-compose.yml logs -f client"
echo "  docker compose -f docker-compose.yml down"}