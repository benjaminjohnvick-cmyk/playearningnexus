# iOS Without a Mac — cloud CI build & submit

You do **not** need to buy a Mac to ship the iOS app. A cloud CI service spins up a Mac, builds and
signs your Capacitor app, and uploads it to the App Store for you. This kit gives you a ready
`codemagic.yaml` and a GitHub Actions workflow. Target: **~5–9h** for the iOS submission.

> **Recommended: Codemagic.** It's built for Capacitor/Ionic, has a **free tier (500 macOS M2
> min/month** — enough for launch), and — crucially — it **manages code signing for you** through an
> App Store Connect API key, which is the part that's painful to do by hand. GitHub Actions works too
> (config included) but you wire signing yourself.

## What you need (all doable from Windows/Linux)
1. **Apple Developer Program** account — **$99/yr** (developer.apple.com). Unavoidable for the App Store.
2. **App Store Connect** → create the app record (bundle id `com.playearningnexus.app`), note its **Apple ID** (a number).
3. An **App Store Connect API key** (Users and Access → Integrations → App Store Connect API): download
   the `.p8`, note the **Key ID** and **Issuer ID**. This lets CI sign and upload without a Mac or manual certs.

---

## Path A — Codemagic (recommended)
1. Sign up at **codemagic.io**, connect your GitHub repo.
2. **Teams → Integrations → App Store Connect**: add your API key (`.p8`, Key ID, Issuer ID). Name it
   `CodemagicASC` (matches the yaml).
3. Copy **`deploy-kit/ci/codemagic.yaml`** to your **repo root** as `codemagic.yaml`, set your app's
   `APP_STORE_APPLE_ID`, commit, and push.
4. In Codemagic, start the `ios-capacitor` workflow. It will: build the web app → `cap sync ios` →
   auto-sign → produce the `.ipa` → upload to **TestFlight**.
5. In App Store Connect: add the build to a version, fill the listing (reuse the Android copy), attach
   screenshots, add a **demo login** in review notes, submit for review.

## Path B — GitHub Actions (free minutes on macOS runners)
1. Copy **`deploy-kit/ci/ios-build.yml`** to **`.github/workflows/ios-build.yml`**.
2. Add these repo **Secrets** (Settings → Secrets and variables → Actions):
   - `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_KEY_P8` (the `.p8` contents)
   - `IOS_BUNDLE_ID` = `com.playearningnexus.app`
3. Push to the branch; the workflow builds on a macOS runner and uploads to TestFlight via the API key.
   (macOS runner minutes are free for public repos and metered for private — a build is a few minutes.)

## Path C — Rent a Mac by the hour (fallback)
If you'd rather click through Xcode yourself: **MacinCloud** (~$1/hr or ~$20–30/mo) or **AWS EC2 mac**
(hourly). Use it only for the build window, then cancel. Follow `MOBILE-APP-WRAPPER-GUIDE.md` §5B.

---

## iOS App Store review reality (read this)
Earn-money apps get extra scrutiny under Apple's rules. To pass first try:
- Give a **demo account** with activity pre-loaded in review notes.
- Frame rewards as **merit/skill-based, not gambling**; no purchase required to earn.
- Make sure the app feels like a real app, not a website in a shell — your Capacitor native bits
  (splash, status bar, push if added) help satisfy Guideline 4.2 (minimum functionality).
- Have **Privacy Policy + Terms** at public URLs and the **account-deletion** path working (Apple requires it).

## Sign-off
- [ ] Apple Developer account + App Store Connect app record · [ ] API key added to CI ·
- [ ] CI produced a signed `.ipa` on TestFlight · [ ] Listing + screenshots + demo login submitted
