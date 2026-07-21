# Nexus backend — Deno runtime (keeps your functions' Deno.serve/Response/Deno.env intact)
FROM denoland/deno:2.1.4
WORKDIR /app
COPY . .
# Cache deps
RUN deno cache server/main.ts || true
EXPOSE 8000
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "server/main.ts"]
