# PlayEarning Nexus — Android & iOS App Wrapper Guide (Capacitor)

This turns your existing PWA into real, submittable **Android (Google Play)** and **iOS (App Store)** apps using **Capacitor**. Capacitor wraps your web build (`dist/`) in a thin native shell.

## Architecture: wrapper-only (no committed native folders)
This project is set up so the repository contains **only the web app + the Capacitor wrapper** — there are **no `android/` or `ios/` project folders in git**. Those are treated as generated build artifacts:
- They're **git-ignored** (`.gitignore`) and **regenerated on demand** with `npm run native:regenerate` (which runs `cap add` + `cap sync`).
- All native behavior (status bar, splash screen, Android back button) is implemented in the **web/TS layer** via Capacitor plugins in `src/lib/native.js` — so there is **no hand-written native code to maintain**.
- Result: one wrapper that evolves with your web app; nothing native to keep in sync by hand.

Trade-off to know: this clean model is ideal when you don't need custom native source. If you later add a plugin that requires editing native files directly, you'd commit `android/`/`ios/` at that point. For a pure web wrapper, generated-and-ignored is best practice.

## What I already added to your repo (the "code" part)
These files are in the codebase now — you don't need to create them:
- **`capacitor.config.json`** — app id (`com.playearningnexus.app`), app name, `webDir: dist`, splash/background config.
- **`package.json`** — Capacitor dependencies (`@capacitor/core`, `/android`, `/ios`, `/app`, `/cli`, `/assets`) and helper scripts (`cap:build`, `cap:add:android`, `cap:add:ios`, `cap:open:android`, `cap:open:ios`, `cap:assets`).
- **`public/manifest.json`** — the PWA manifest that was missing (name, icons, standalone display, theme color).
- **`index.html`** — added mobile/PWA meta tags (theme-color, iOS standalone, apple-touch-icon).

The parts that **can't** be done in the cloud and must run on your machine: `npm install`, generating the native `android/` and `ios/` projects, and building/submitting — iOS specifically **requires a Mac with Xcode**.

---

## What you need
- **Node.js 18+** on your computer.
- **Android:** [Android Studio](https://developer.android.com/studio) (any OS).
- **iOS:** a **Mac** with **Xcode** (Apple requirement — cannot be done on Windows/Linux).
- **App icon:** one square PNG, **1024×1024**, saved as `assets/icon.png` in the project (Capacitor's asset generator makes all the sized icons from it).
- **Developer accounts:** [Google Play Console](https://play.google.com/console) ($25 one-time), [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).

---

## Step-by-step

### 1. Get the updated repo locally
Pull the repo (which now includes the wrapper files) to your computer or Codespace:
```
git clone https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
cd playearningnexus
```
(For iOS you must do this on a Mac.)

### 2. Install dependencies
```
npm install
```

### 3. Add your app icon, then generate all icon/splash assets
- Put your 1024×1024 icon at `assets/icon.png` (optionally `assets/splash.png` 2732×2732).
- Generate every platform size:
```
npm run cap:assets
```

### 4. Generate the native shells from the wrapper (one command)
```
npm run native:regenerate
```
This builds `dist/`, generates icons, creates the `android/` (and, on a Mac, `ios/`) shells if they don't exist, and syncs everything. The generated folders are git-ignored — you never commit them; just re-run this command whenever you build.

### 5A. Android → Google Play
```
npm run cap:open:android
```
In Android Studio:
1. Let Gradle finish syncing.
2. Set the app version in `android/app/build.gradle` (`versionCode`, `versionName`).
3. **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)** — create a signing key and keep it safe (you need it for every future update).
4. Upload the `.aab` in **Play Console → Create app → Production → Create release**.
5. Fill in store listing, privacy policy URL, content rating, data-safety form → submit for review.

### 5B. iOS → App Store (Mac only)
```
npm run cap:open:ios
```
In Xcode:
1. Select the project → **Signing & Capabilities** → pick your Apple Developer **Team**; confirm the Bundle Identifier (`com.playearningnexus.app`).
2. Set version/build numbers.
3. Choose **Any iOS Device**, then **Product → Archive**.
4. In the Organizer, **Distribute App → App Store Connect → Upload**.
5. In [App Store Connect](https://appstoreconnect.apple.com): create the app, fill in listing, privacy details, screenshots → submit for review.

### 6. Updating the app later
Whenever you change the web app: `npm run cap:build`, then rebuild/re-archive in Android Studio / Xcode and upload a new version. (Because the web build is bundled, content changes ship with an app update. See the "live URL" option below to update content without resubmitting.)

---

## Optional: load the live site instead of bundling (faster content updates)
If you'd rather the app always load your deployed site (so web changes appear without a store resubmission), add this to `capacitor.config.json` and re-sync:
```json
"server": { "url": "https://YOUR-DEPLOYED-DOMAIN", "cleartext": false }
```
Trade-off: Apple review is stricter on apps that are "just a web view," so bundling (the default I set up) is usually the safer route for approval.

## Optional: native push notifications
You already have web push. For native push, add `@capacitor/push-notifications` and wire up **Firebase (FCM)** for Android and **APNs** for iOS. This is a separate setup — do it after the base app is approved.

---

## ⚠️ App Store review reality (read before you submit)
- **Apple Guideline 4.2 ("minimum functionality"):** Apple rejects apps that are just a repackaged website. Your app is feature-rich (games, surveys, referrals, notifications), which helps, but present it as an app, not a website link.
- **Earning / rewards / payments:** Apps where users earn money or make payments get extra scrutiny. Apple generally requires **in-app purchase** for digital goods and has rules about "earn money" incentives; cash-out and real-money features can trigger review pushback. Google has its own rewards/gambling policies. Have your payments and rewards flows reviewed against both stores' current policies before submitting.
- **Skill contests / prizes / money pooling:** the skill-tournament and shared-wallet features may need region gating and clear terms (tie in with `COMPLIANCE-AND-ASSUMPTIONS.md`).
- **Privacy:** both stores require a privacy policy URL and a data-safety / privacy-nutrition-label disclosure. Prepare these first.

---

## Zero-code alternative: PWABuilder
If you'd rather not manage native projects at all, once your PWA is deployed to a public URL:
1. Go to **[pwabuilder.com](https://www.pwabuilder.com)** and enter your deployed URL.
2. It reads your `manifest.json` (now present) and generates a **Google Play package (TWA)** and an **iOS package** for you to submit.
This is the least-effort path for a PWA → stores, though Capacitor (set up above) gives you more native control and a better shot at App Store approval.
