#!/bin/sh
# nginx entrypoint with dynamic DNS resolution.
# The resolver directive in nginx.conf uses Docker's internal DNS (127.0.0.11)
# with a 5s TTL, so nginx automatically re-resolves the API hostname after
# container restarts — no watchdog needed.

exec nginx -g 'daemon off;'
