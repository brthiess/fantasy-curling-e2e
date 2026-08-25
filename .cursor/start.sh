#!/usr/bin/env bash
#
# Cloud Agent start script. Runs on every boot to bring up the local MongoDB
# instance that the E2E harness (via MONGO_URL) and the CMS depend on. It is
# idempotent, returns once mongod is ready, and never blocks the boot.
set -euo pipefail

DBPATH=/var/lib/mongodb
LOGPATH=/var/log/mongodb/mongod.log

mkdir -p "$DBPATH" "$(dirname "$LOGPATH")"

if pgrep -x mongod >/dev/null 2>&1; then
  echo "==> mongod already running"
else
  echo "==> Starting mongod"
  mongod --dbpath "$DBPATH" --bind_ip 127.0.0.1 --port 27017 --logpath "$LOGPATH" --fork
fi

# Wait for readiness so dependent services can connect immediately.
for _ in $(seq 1 30); do
  if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
    echo "==> mongod is ready on mongodb://127.0.0.1:27017"
    exit 0
  fi
  sleep 1
done

echo "!! mongod did not become ready in time" >&2
tail -n 20 "$LOGPATH" 2>/dev/null || true
exit 1
