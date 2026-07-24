# Frontend (React + Vite PWA) for Railway — builds the static site and serves it
# with SPA history fallback (so deep links like /Wallet resolve to index.html).
#
# Place this at the REPO ROOT as `Dockerfile` for the frontend service, OR point the
# Railway service's Dockerfile path at deploy-kit/railway/frontend.Dockerfile.
#
# Railway injects your service variables as build args — set VITE_NEXUS_API_URL (your
# backend's public URL) as a service variable and it flows into the build below.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# --ignore-scripts skips the native `sharp` postinstall (not needed for the web build)
RUN npm install --ignore-scripts
COPY . .
ARG VITE_NEXUS_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_PAYPAL_CLIENT_ID
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_NEXUS_API_URL=$VITE_NEXUS_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN npm run build

# Serve the built static files. `serve -s` = single-page-app fallback built in.
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
# Railway sets $PORT; default to 3000 locally.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
