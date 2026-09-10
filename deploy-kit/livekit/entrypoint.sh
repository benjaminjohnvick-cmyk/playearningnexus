#!/bin/sh
# Render /livekit.yaml from environment, then start livekit-server. POSIX sh only (the base image is Alpine).
# Secrets never live in the image — they come from Railway service variables at runtime.
#
# Required env:
#   LIVEKIT_API_KEY, LIVEKIT_API_SECRET   — the key/secret pair the app's sessionLiveKitToken signs with.
#   One of: REDIS_URL   (redis://[user]:[pass]@host:port, e.g. Railway's Redis plugin var)
#        or REDIS_HOST + REDIS_PORT [+ REDIS_PASSWORD]
# Optional:
#   PORT  — Railway injects this; LiveKit signaling binds to it (default 7880).
set -e

# --- Redis: accept a URL or discrete vars ---
if [ -n "$REDIS_URL" ]; then
  no_proto="${REDIS_URL#*://}"          # strip redis://
  creds="${no_proto%@*}"                # [user]:[pass]  (or the host if no '@')
  hostport="${no_proto##*@}"            # host:port
  REDIS_HOST="${hostport%%:*}"
  REDIS_PORT="${hostport##*:}"
  case "$no_proto" in
    *@*) case "$creds" in *:*) REDIS_PASSWORD="${creds#*:}";; esac ;;
  esac
fi
: "${REDIS_HOST:?REDIS_HOST or REDIS_URL is required}"
: "${REDIS_PORT:=6379}"
: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET is required}"
: "${PORT:=7880}"

cat > /livekit.yaml <<EOF
port: ${PORT}
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50200
  use_external_ip: true
redis:
  address: ${REDIS_HOST}:${REDIS_PORT}
  password: ${REDIS_PASSWORD}
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
turn:
  enabled: false
logging:
  level: info
EOF

echo "livekit: starting on :${PORT} (rtc-tcp 7881), redis ${REDIS_HOST}:${REDIS_PORT}"
exec livekit-server --config /livekit.yaml
