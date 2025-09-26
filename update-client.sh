#!/bin/bash
set -e

echo "📥 Pulling latest code from origin/master..."
git pull origin master

echo "♻️ Rebuilding client and backend..."
docker compose build --no-cache client backend

echo "🚀 Restarting services..."
docker compose up -d client backend

