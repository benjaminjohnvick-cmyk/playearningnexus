# LiveKit media node for Railway — a self-contained service Railway can build from this folder and scale
# horizontally (replicas share Redis, so they form ONE cluster). The livekitScaleController sets the replica
# count on this service via the Railway API as concurrent viewers rise/fall. See RAILWAY-LIVEKIT-DEPLOY.md.
FROM livekit/livekit-server:latest

# Render the config from env at start (keeps API key/secret + Redis creds OUT of the image).
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 7880 = HTTP/WebSocket signaling (this is the port Railway exposes publicly, TLS-terminated → wss://…).
# 7881 = ICE/TCP media fallback (used when UDP isn't reachable — the case on Railway).
EXPOSE 7880 7881
ENTRYPOINT ["/entrypoint.sh"]
