# Mobile OTA Live Updates — ship web-layer changes with no App Store review

**Bottom line: ongoing changes to GamerGain are store-review-free.** GamerGain is a React web app inside
a thin Capacitor shell, so nearly all of the app — every screen, all the logic — is a **web bundle**
(JS/HTML/CSS). Over-the-air (OTA) live updates push a new web bundle straight to installed native apps;
the native shell never changes, so **Apple/Google review is not required** for web-layer changes. Users
pick up the update on next app open/login, with no downtime.

## What needs review vs. what doesn't

| Change | Store review? | How it ships |
|---|---|---|
| AI/self-learning config, flags, UI variants, thresholds, copy, prompts | **No** | Server config — read at request time |
| Web-layer code: React screens, components, logic, styles, bug fixes | **No** | **OTA bundle** (this doc) |
| PWA / web | **No** | Always instant |
| New **native** plugin, new OS permission (camera, health, etc.), or a change to the app's core purpose | **Yes** | Normal store release |

So the autonomous learning system needs **zero** store involvement (it only flips config), and human-built
React features ship via OTA — you only return to the store for genuinely native additions.

## Policy (so this stays legitimate)

Apple guideline **3.3.2** and Google's policies permit updating the interpreted web/JS layer as long as
it does **not** change the app's core purpose or bypass review. OTA here is for bug fixes, UI changes, and
A/B variants — **not** for shipping a fundamentally different app. Keep updates in-scope and you're within
policy.

## How it's wired in this repo

- `src/lib/otaUpdate.js` — a **guarded** integration of the open-source `@capgo/capacitor-updater`. It
  dynamically imports the plugin; if the plugin isn't installed (or on web/PWA), every call **no-ops**, so
  the build and app work normally today.
- `src/lib/native.js` — calls `initOta()` on native boot and re-checks for a bundle on **app resume**
  (alongside re-pulling the user's variant assignments), so a promoted change applies on next foreground.
- `capacitor.config.json` — a `CapacitorUpdater` block (`autoUpdate: true`) that's inert until the plugin
  is installed.

## Going live (one-time native setup, then no more store trips)

1. Install the plugin: `npm i @capgo/capacitor-updater`.
2. Pick a channel host — **self-host** (open-source Capgo server / your own bucket) to stay free, or Capgo
   cloud. Configure it with the Capgo CLI: `npx @capgo/cli init`.
3. Rebuild and submit the native apps **once** (so the plugin is in the binary).
4. From then on, ship web changes with **no store submission**:
   ```
   npm run build
   npx @capgo/cli bundle upload --channel production
   ```
   Installed apps download the new bundle in the background and apply it on next open. `notifyAppReady()`
   (called in `initOta`) prevents a broken bundle from sticking — a bad update auto-rolls back.

## How this ties into the learning system

The live-experiment + personalization engine promotes changes as **config flips** (settings/flags/UI
variants) that every platform reads at request time — those never needed the store to begin with. OTA
covers the other bucket: when a human ships new **web code**, it reaches installed native apps the same
no-downtime, next-open way. Together, essentially all ongoing change — autonomous or human — reaches web,
PWA, and native without an App Store gate.

## Honest limits

- OTA updates the **web layer only**. New native plugins / permissions still need a store release.
- Don't use OTA to change the app's core purpose or dodge review — that violates store policy.
- The plugin must be installed and a channel configured (steps above); until then OTA is inactive and the
  apps simply update the normal way.
