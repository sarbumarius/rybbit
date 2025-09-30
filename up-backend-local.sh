#!/bin/bash
set -euo pipefail

# Dacă vrei să schimbi tag-ul, îl poți da ca argument
TAG=${1:-dev}

echo "🛑 Oprire container backend existent (dacă rulează)..."
docker compose -f docker-compose.backend.yml down backend || true

echo "🚀 Build imagine backend local: rybbit-backend:${TAG}"
docker compose -f docker-compose.backend.yml build backend

echo "🔄 Pornire backend nou..."
docker compose -f docker-compose.backend.yml up -d backend

echo "✅ Backend este pornit cu imaginea locală rybbit-backend:${TAG}"
