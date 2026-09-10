# Hosted Sessions — Live Screen-Share & Live Shopping (LiveKit) · Design & Decision Doc

**Date:** 2026-09-10 · **Status:** implementation validated (build + audit); needs LiveKit server provisioned + a short smoke test before enabling.

## Goal

Let a member **go live and screen-share** to viewers in-app (buy an app → share it; small co-op; live shopping),
with reliable multi-device video **and without us doing device QA**.

## Decision

Use **LiveKit** — an **open-source, self-hostable WebRTC SFU** — as the transport, instead of a hand-rolled
phone-to-phone mesh.

**Why (the trade-off we chose):** a hand-rolled P2P mesh is the cheapest/most "phone-to-phone," but its risky
part (real NAT traversal across mobile carriers, iOS Safari quirks) can only be proven on real devices — device
QA can't be eliminated. LiveKit's clients are **battle-tested across millions of devices**, so we inherit that
testing and our integration surface stays tiny (**one token endpoint + the client SDK**). It also **scales past
the ~6-viewer phone cap** to real broadcasts. The cost: it's a **media server (SFU), not literally
phone-to-phone** — but LiveKit is **self-hosted**, so it's *your* server + *your* TURN (coturn), no third party,
consistent with the self-hosted ethos.

## What ships in this build

- **Backend `sessionLiveKitToken`** — mints a LiveKit access token (HS256 JWT, signed with the LiveKit API secret
  via the existing `djwt`): **host** gets a publish grant (screen share), **viewer** gets subscribe-only (+ data
  for buy pings). API key/secret/URL live in the **server env** — never in the client bundle. It also registers a
  `GameSession` for the room so the existing **live-shopping order** path can find it. Gated behind
  `SESSION_HOSTING_ENABLED`; non-game hosting still requires `HOSTING_ALLOW_NONGAME` + a content-policy ack.
- **`src/pages/HostStudio.jsx`** — go live, screen-share (LiveKit `setScreenShareEnabled` → OS picker), local
  preview, viewer count, copy-a-viewer-link, and **feature a product** (published to viewers over LiveKit data).
- **`src/pages/WatchSession.jsx`** — join a room (`?room=`), watch the host's screen, and on a featured product
  **Buy** (`liveShoppingOrder`, Site Cash) or mark **Interested**. Both pages **dynamic-import** `livekit-client`
  so the SDK only loads when actually hosting/watching.
- **Dependency:** `livekit-client` added to `package.json` (run `npm install`).

Both pages auto-route (`/HostStudio`, `/WatchSession`) via the app's page router.

## Gating & compliance (unchanged)

`SESSION_HOSTING_ENABLED` (master), `HOSTING_ALLOW_NONGAME` (screen/stream — pending moderation + DMCA agent),
`HOSTING_LIVE_SHOPPING_ENABLED` (selling). All remain **OFF by default** and counsel/ops-gated; the legal
questions (screen-mirror moderation, DMCA agent, minors, recording consent) stay in
`HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF.md`. Site-Cash invariant holds: buyers spend Site Cash; business
sellers are paid real money through the existing order→fulfillment→funds-release pipeline.

## Ops to go live (not shipped in code)

1. **Deploy LiveKit** (self-hosted, Docker/Helm) + a **TURN** server (coturn). Both self-hostable — your infra.
2. Set env on the backend: `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Until set, the UI
   shows a clean "media server not connected yet" state (no crash).
3. Enable the gates in the Setup Wizard (after moderation + counsel per the hosting brief).
4. **Smoke test** on two real devices/networks (this is the *only* device testing needed — LiveKit's transport is
   already proven; we're just confirming our token + wiring on real hardware).

## Non-goals / notes

- Recording/egress uses LiveKit's server-side egress (separate ops toggle), not shipped here.
- Large broadcasts are handled by the SFU (it forwards the host's single upload to many) — no phone fan-out cap.
