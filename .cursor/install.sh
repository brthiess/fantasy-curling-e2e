#!/usr/bin/env bash
#
# Cloud Agent install script for the Fantasy Curling platform.
#
# This repository (fantasy-curling-e2e) is the primary repo; the frontend
# (fantasy-curling), backend (fantasy-curling-backend), and CMS (cms) are cloned
# as sibling directories by the multi-repo environment. This script installs
# every service's dependencies plus the local infrastructure the E2E harness
# needs (MongoDB + a Playwright browser).
#
# The E2E and CMS repos are still early-stage, so their steps are intentionally
# best-effort: a repo that cannot fully install or generate yet emits a warning
# but never aborts setup, so the mature frontend/backend stack still comes up.
# The script is idempotent and safe to run repeatedly.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$E2E_DIR/.." && pwd)"

FRONTEND_DIR="$WORKSPACE_DIR/fantasy-curling"
BACKEND_DIR="$WORKSPACE_DIR/fantasy-curling-backend"
CMS_DIR="$WORKSPACE_DIR/cms"

warn() { echo "WARNING: $*" >&2; }

# Run a step in a subshell; on failure, warn and keep going instead of aborting.
run_optional() {
  local desc="$1"
  shift
  echo "==> $desc"
  if "$@"; then
    return 0
  fi
  warn "$desc failed (continuing; this repo may still be in early setup)"
  return 0
}

install_node_deps() {
  local dir="$1"
  if [ ! -f "$dir/package.json" ]; then
    echo "==> Skipping $dir (no package.json found)"
    return 0
  fi
  echo "==> Installing npm dependencies in $dir"
  if ( cd "$dir" && ( npm ci || npm install ) ); then
    echo "==> Dependencies ready in $dir"
  else
    warn "npm install failed in $dir (continuing; repo may be mid-setup)"
  fi
}

# 1. MongoDB server.
# Docker/Testcontainers is unavailable inside Cloud Agent VMs, so the E2E harness
# falls back to an external mongod via MONGO_URL, and the CMS connects to the same
# instance. Install the server binary here so it is baked into the environment build.
if ! command -v mongod >/dev/null 2>&1; then
  echo "==> Installing MongoDB server (8.0)"
  if curl -fsSL https://pgp.mongodb.com/server-8.0.asc \
        | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor \
     && echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
        | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list >/dev/null \
     && sudo apt-get update -qq \
     && sudo apt-get install -y -qq mongodb-org; then
    echo "==> MongoDB installed"
  else
    warn "MongoDB install failed (backend/CMS/E2E DB features will be unavailable until fixed)"
  fi
fi

# Ensure the mongod data/log directories exist and are writable by the runtime user.
sudo mkdir -p /var/lib/mongodb /var/log/mongodb || warn "could not create mongod directories"
sudo chown -R "$(id -u):$(id -g)" /var/lib/mongodb /var/log/mongodb 2>/dev/null || true

# 2. JavaScript/TypeScript dependencies for every repo present in the workspace.
#    Frontend and backend are the mature core; E2E and CMS are best-effort.
install_node_deps "$BACKEND_DIR"
install_node_deps "$FRONTEND_DIR"
install_node_deps "$E2E_DIR"
install_node_deps "$CMS_DIR"

# 3. Playwright browser used by the (early-stage) smoke suite.
if [ -d "$E2E_DIR/node_modules/@playwright" ]; then
  run_optional "Installing Playwright chromium browser" \
    bash -c "cd '$E2E_DIR' && npx --yes playwright install --with-deps chromium"
else
  echo "==> Skipping Playwright browser install (E2E deps not installed yet)"
fi

# 4. CMS (Payload) local config + generated artifacts (best-effort; repo is nascent).
if [ -f "$CMS_DIR/package.json" ]; then
  if [ ! -f "$CMS_DIR/.env.local" ]; then
    echo "==> Writing $CMS_DIR/.env.local"
    cat > "$CMS_DIR/.env.local" <<'EOF' || warn "could not write CMS .env.local"
DATABASE_URI=mongodb://127.0.0.1:27017
DATABASE_NAME=curling_cms_local
PAYLOAD_SECRET=local-dev-only-secret-change-me-0123456789abcdef
EOF
  fi
  if [ -d "$CMS_DIR/node_modules" ]; then
    run_optional "Generating Payload import map" \
      bash -c "cd '$CMS_DIR' && npm run payload:generate-importmap"
    run_optional "Generating Payload types" \
      bash -c "cd '$CMS_DIR' && npm run payload:generate-types"
  else
    echo "==> Skipping Payload generation (CMS deps not installed yet)"
  fi
fi

# 5. E2E harness .env pointing at the sibling checkouts + local mongod fallback.
if [ -f "$E2E_DIR/package.json" ] && [ ! -f "$E2E_DIR/.env" ]; then
  echo "==> Writing $E2E_DIR/.env"
  # Reuse the frontend's committed devlocal Supabase values when available.
  SUPA_URL="https://bfowoipcfrnslyegoeoq.supabase.co"
  SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb3dvaXBjZnJuc2x5ZWdvZW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODg0NzQsImV4cCI6MjA4OTk2NDQ3NH0.mABP__4fBXBIb29Mg8GfWHi2j_yLL9ej81C3hF1PYWM"
  if [ -f "$FRONTEND_DIR/.env.devlocal" ]; then
    FRONTEND_SUPA_URL="$(grep -E '^VITE_SUPABASE_URL=' "$FRONTEND_DIR/.env.devlocal" | head -1 | cut -d= -f2-)"
    FRONTEND_SUPA_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$FRONTEND_DIR/.env.devlocal" | head -1 | cut -d= -f2-)"
    [ -n "${FRONTEND_SUPA_URL:-}" ] && SUPA_URL="$FRONTEND_SUPA_URL"
    [ -n "${FRONTEND_SUPA_KEY:-}" ] && SUPA_KEY="$FRONTEND_SUPA_KEY"
  fi
  cat > "$E2E_DIR/.env" <<EOF || warn "could not write E2E .env"
# Systems under test (sibling checkouts)
BACKEND_DIR=../fantasy-curling-backend
FRONTEND_DIR=../fantasy-curling

# Frontend runtime values
FRONTEND_URL=http://localhost:5173
FRONTEND_START_COMMAND=npm run dev -- --mode devlocal
VITE_API_ENV=devlocal
VITE_SUPABASE_URL=$SUPA_URL
VITE_SUPABASE_ANON_KEY=$SUPA_KEY

# Backend runtime values
BACKEND_URL=http://localhost:3000
BACKEND_START_COMMAND=npm run start:dev
NODE_ENV=test

# The E2E harness seeds and RESETS collections, so it always targets a local mongod
# via E2E_MONGO_URL and never the app's real MONGO_URL (e.g. an injected Atlas URL).
# Docker/Testcontainers is unavailable in Cloud Agent VMs, so this local mongod is
# started by .cursor/start.sh.
E2E_MONGO_URL=mongodb://localhost:27017

# Keep SUPABASE_PROJECT_ID unset to force deterministic local JWT mode in backend

# Deterministic smoke credentials (must exist in the seeded auth system)
E2E_USER_EMAIL=test@example.com
E2E_USER_PASSWORD=Password123!
EOF
fi

echo "==> install.sh complete"
