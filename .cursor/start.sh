#!/usr/bin/env bash
#
# Cloud Agent start script. Runs on every boot to bring up the local MongoDB
# instance that the E2E harness (via MONGO_URL) and the CMS depend on. It is
# idempotent and never blocks the boot: if mongod is unavailable (e.g. an early
# setup where install could not complete), it warns and exits successfully so the
# rest of the environment still starts.
set -uo pipefail

DBPATH=/var/lib/mongodb
LOGPATH=/var/log/mongodb/mongod.log

if ! command -v mongod >/dev/null 2>&1; then
  echo "WARNING: mongod is not installed; skipping MongoDB startup" >&2
  exit 0
fi

mkdir -p "$DBPATH" "$(dirname "$LOGPATH")" 2>/dev/null || true

if pgrep -x mongod >/dev/null 2>&1; then
  echo "==> mongod already running"
else
  echo "==> Starting mongod"
  if ! mongod --dbpath "$DBPATH" --bind_ip 127.0.0.1 --port 27017 --logpath "$LOGPATH" --fork; then
    echo "WARNING: mongod failed to start; see $LOGPATH" >&2
    tail -n 20 "$LOGPATH" 2>/dev/null || true
    exit 0
  fi
fi

# Wait for readiness so dependent services can connect immediately.
for _ in $(seq 1 30); do
  if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
    echo "==> mongod is ready on mongodb://127.0.0.1:27017"
    exit 0
  fi
  sleep 1
done

echo "WARNING: mongod did not become ready in time" >&2
tail -n 20 "$LOGPATH" 2>/dev/null || true
exit 0
