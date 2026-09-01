# Update the site without taking it down

You can change the running site three ways, from "instant, no deploy" to "full code deploy" — none of
them require downtime.

## 1. Change behavior instantly — no deploy at all
Every gated feature and tunable is a **live setting in the database** (the Setup Wizard / Admin settings,
read through `feature-flags.ts` / `snapBool` / `isEnabled`). Flip a feature on/off, change a limit, enable a
new market — it takes effect on the next request. Nothing rebuilds, nothing restarts. This is the fastest way
to "code in a change": if the behavior is already behind a flag, you just flip the flag.

## 2. Deploy new code — zero downtime, automatic
Pushing to `main` on GitHub auto-deploys via the **Deploy (CI/CD)** workflow (when the `RAILWAY_TOKEN` repo
secret is set). The deploy is now **zero-downtime**, enforced by config in `backend/railway.json`:

- **`healthcheckPath: "/health"`** — Railway builds the new version and calls `/health` before sending it any
  traffic.
- **`overlapSeconds: 60`** — the OLD version keeps serving the whole time the new one is starting and being
  health-checked. Traffic only switches once the new version is healthy.
- **`drainingSeconds: 30`** — when the old version is finally removed, in-flight requests are allowed to
  finish first (graceful drain), so no request is cut off.

Net effect: you push code, the site stays up the entire time, and visitors are moved to the new version only
after it's proven healthy. If the new version fails its health check, Railway keeps the old one live and the
deploy simply doesn't cut over — a bad build can't take the site down.

**Crash protection is on:** `numReplicas` is set to **2** in `backend/railway.json`, so there are always
multiple instances behind the load balancer. If one instance dies mid-traffic, the other keeps serving — this
protects against a crash, not just a deploy. (Raise it further for more headroom at more cost; drop to 1 to
minimize cost, which is still zero-downtime for *deploys* thanks to the overlap above.)

## 3. Update the mobile apps automatically — no store re-review
The same live-update model reaches the mobile apps. The Capacitor apps carry an OTA updater
(`CapacitorUpdater` + `src/lib/otaUpdate.js`), and the **Deploy (CI/CD)** workflow's **`ota-mobile`** job
publishes the web bundle to installed apps on every push to `main` — automatically, once a `CAPGO_TOKEN`
secret is set (it skips gracefully until then). Apps download the change in the background and apply it on
next open, and a bad bundle auto-rolls back (`notifyAppReady`). So a web-layer change you push updates the
site **and** the mobile apps with no manual step and no App Store / Play review. Native-shell changes (new
plugins/permissions) still need a normal store release. Full detail: `MOBILE-OTA-LIVE-UPDATES.md`.

## The database itself
Schema changes are additive and auto-migrate on boot (`schema.sql` uses `CREATE TABLE IF NOT EXISTS` and JSONB
`data`, so new fields need no migration and old rows keep working). That's why a new feature — like this
session's `BuddyNextSession` — deploys with no manual DB step and no downtime.

## One-line summary
Flip a flag for an instant change; push to `main` for a health-checked, overlapping, zero-downtime code
deploy; use OTA for the apps. The site never has to go down to accept an update.
