#!/usr/bin/env bash
# =============================================================
# BFP — Production Build Script
# Run from the project root: bash scripts/build-production.sh
# =============================================================
set -e

echo ""
echo "================================================"
echo "  BFP — Business Flow Pro | Production Build"
echo "================================================"
echo ""

# Load .env if present (for VITE_API_BASE_URL etc.)
if [ -f .env ]; then
  echo "→ Loading .env..."
  set -a; source .env; set +a
fi

export NODE_ENV=production
export PORT=${PORT:-8080}
export BASE_PATH=${BASE_PATH:-/}

echo "→ Installing dependencies..."
pnpm install --frozen-lockfile

echo "→ Building frontend (React + Vite)..."
pnpm --filter @workspace/business-automation run build

echo "→ Building API server (esbuild)..."
pnpm --filter @workspace/api-server run build

echo ""
echo "✓ Build complete!"
echo ""
echo "Output files:"
echo "  Frontend : artifacts/business-automation/dist/public/"
echo "  API      : artifacts/api-server/dist/index.cjs"
echo ""
echo "To start the server:"
echo "  node artifacts/api-server/dist/index.cjs"
echo ""
