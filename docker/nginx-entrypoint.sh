#!/bin/sh
# Custom entrypoint: starts nginx, then periodically checks if the
# api upstream is reachable. If not, reloads nginx to refresh DNS.
# This fixes the recurring hang caused by stale DNS after API restarts.

set -e

# Start nginx in background
nginx -g 'daemon off;' &
NGINX_PID=$!

# Wait for nginx to start
sleep 2

# Watchdog loop: every 30s, check if api is reachable via our proxy
while kill -0 $NGINX_PID 2>/dev/null; do
  sleep 30
  # Quick check: can nginx reach the API?
  if ! wget -qO /dev/null --timeout=3 http://localhost/api/healthz 2>/dev/null; then
    echo "[watchdog] API unreachable via proxy, reloading nginx to refresh DNS..."
    nginx -s reload 2>/dev/null || true
    sleep 5
  fi
done

# If nginx exits, exit the container
wait $NGINX_PID
