# PlayEarning Nexus — App Store Pre-Submission Checklist

Work top to bottom before you upload to **Google Play** or the **Apple App Store**. Anything marked **BLOCKER** will get your app rejected or delayed if skipped. Companion docs: `MASTER-LAUNCH-GUIDE.md`, `MOBILE-APP-WRAPPER-GUIDE.md`, `LEGAL-PAGES-GUIDE.md`, `COMPLIANCE-AND-ASSUMPTIONS.md`.

Because this app involves **earning money, payouts, referrals, and prize pools**, it gets extra scrutiny from both stores. Budget time for at least one round of review questions.

---

## 1. App identity & assets

- [ ] **Real app icon** — replace the placeholder at `assets/icon.png` with your final 1024×1024 PNG (no transparency, no rounded corners — the stores round it). Then run `npm run cap:assets` to regenerate every size. **BLOCKER** for a professional listing.
- [ ] **Splash screen** (optional) — add `assets/splash.png` (2732×2732) if you want a branded launch screen; re-run `npm run cap:assets`.
- [ ] **App name** confirmed consistent everywhere: `capacitor.config.json`, `public/manifest.json`, store listings.
- [ ] **Bundle/App ID** matches in both stores: `com.playearningnexus.app` (Android `applicationId`, iOS Bundle Identifier).
- [ ] **Version numbers** set: Android `versionCode`/`versionName` in `android/app/build.gradle`; iOS version/build in Xcode.

## 2. Legal pages — BLOCKER for both stores

Both stores require a **live, publicly reachable privacy policy URL** before you can submit.

- [ ] Fill in every `[BRACKET]` placeholder in `PRIVACY-POLICY.md` / `src/pages/PrivacyPolicy.jsx` (company legal name, effective date, contact email, governing state/country).
- [ ] Fill in every `[BRACKET]` placeholder in `TERMS-OF-SERVICE.md` / `src/pages/TermsOfService.jsx`.
- [ ] **Have a lawyer review both** — these are templates, not legal advice, and this app touches money transmission, referrals/endorsements, and prize contests.
- [ ] Confirm the pages are reachable at public URLs on your deployed site (e.g. `https://yourdomain.com/PrivacyPolicy` and `/TermsOfService`).
- [ ] Have those two URLs ready to paste into both store consoles.

## 3. Google Play Data Safety form — BLOCKER

Play requires you to declare what data you collect and why.

- [ ] List every data type collected: account info, email, payment info, device identifiers, approximate/precise location (if used), usage analytics.
- [ ] Declare encryption in transit and whether users can request deletion.
- [ ] Make sure the form matches what the app + Base44 backend actually collect (mismatches get flagged).
- [ ] Complete **Content rating** questionnaire (the earning/contest features affect the rating).
- [ ] Complete the **Financial features** declaration if prompted (payments, "earn real money").

## 4. Apple privacy "nutrition label" + review notes — BLOCKER

- [ ] Fill in **App Privacy** details in App Store Connect (mirrors the Play Data Safety answers).
- [ ] Write **App Review notes**: explain how earning works, that payouts go through Stripe/PayPal, and that contests are **skill/merit-based, not gambling** (reference your compliance doc). This heads off the most common rejection questions.
- [ ] Provide a **demo account** (test login) so reviewers can see the earning/referral flows without signing up.

## 5. Payments & rewards policy review — BLOCKER (highest-risk area)

This is where earn-money apps most often get rejected. Review your flows against **current** store policies before submitting.

- [ ] **Apple Guideline 3.1 (In-App Purchase):** if you sell any *digital* goods/credit, Apple generally requires IAP. Cash-out of *real* earned money is different — make the distinction explicit in review notes.
- [ ] **Apple Guideline 4.2 (minimum functionality):** present as a real app (games, surveys, referrals), not a repackaged website.
- [ ] **Google Play real-money / rewards policies:** confirm the prize pool and referral rewards comply; keep them **skill/merit-based** per `COMPLIANCE-AND-ASSUMPTIONS.md`.
- [ ] **FTC #ad disclosure** is enforced on referral posts (already wired in code) — keep it, reviewers may check.
- [ ] **Region gating:** decide which regions the earning/prize/shared-wallet features are available in, and gate accordingly (money-transmitter and sweepstakes laws vary by state/country).
- [ ] Confirm **payout provider terms** (Stripe/PayPal) allow your payout model.

## 6. Store listing content

- [ ] Screenshots for required device sizes (Play: phone + optional tablet; Apple: 6.7" and 5.5" iPhone at minimum, iPad if you support it).
- [ ] Feature graphic (Play, 1024×500).
- [ ] Title, short description, full description — describe it as an app; avoid over-promising earnings (both stores dislike "get rich" claims).
- [ ] Category, contact email, support URL, marketing URL (optional).
- [ ] Keywords (Apple).

## 7. Technical / build

- [ ] `npm run native:regenerate` completes cleanly (builds `dist/`, generates icons, creates/syncs `android/` and, on a Mac, `ios/`).
- [ ] Android **signed** `.aab` produced via Android Studio — **save the signing keystore somewhere safe; you need it for every future update.** Losing it means you can't update the app. **BLOCKER** if lost later.
- [ ] iOS archive built and uploaded via Xcode (Mac only), with a valid Apple Developer **Team** selected under Signing & Capabilities.
- [ ] Test on a **real device** (not just simulator): sign-in, a survey completion + reward, a payout request, push notification, deep links.
- [ ] Confirm the app points at your **production** backend, not a dev/test environment.

## 8. Accounts & fees (have these ready)

- [ ] **Google Play Console** account — $25 one-time.
- [ ] **Apple Developer Program** — $99/year (required even to submit).
- [ ] Payout/tax info completed in both consoles if you'll ever charge or receive money through the stores.

---

## Recommended submission order
1. Finish icon + legal pages + deploy site (so the privacy URL is live).
2. Complete Data Safety / App Privacy forms.
3. Build signed Android `.aab` → submit to Play (usually faster review).
4. Build iOS archive → submit to App Store with detailed review notes + demo account.
5. Respond quickly to any reviewer questions — for earn-money apps, expect at least one.

> None of this is legal advice. The money, referral, and contest features specifically warrant a lawyer's sign-off before you go live.
