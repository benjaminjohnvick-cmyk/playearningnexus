# Privacy Policy & Terms — Setup & Usage Guide

## What was added to the app
- **In-app pages (live in the PWA):**
  - Privacy Policy → route **`/PrivacyPolicy`** (`src/pages/PrivacyPolicy.jsx`)
  - Terms of Service → route **`/TermsOfService`** (`src/pages/TermsOfService.jsx`)
  - Both are **public** (render without login) so app-store reviewers and users can always reach them.
  - Linked in the app's side navigation (Account section) and cross-linked to each other.
- **Standalone documents:** `PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md` (same content, for your records / website).
- **App icons:** `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, and `assets/icon.png` (1024, source for native builds). These are **placeholders** — swap in your real brand icon and re-run `npm run cap:assets`.

## ⚠️ Important: these are TEMPLATES, not final legal documents
They are tailored to this app (surveys, earnings, referrals, skill contests, wallet groups) but **must be reviewed by a lawyer** before launch. This is not legal advice.

## What you must fill in (search for these placeholders)
- `[EFFECTIVE DATE]`
- `[COMPANY LEGAL NAME]`
- `[privacy@yourdomain.com]` / `[support@yourdomain.com]`
- `[ADDRESS]`
- `[STATE/COUNTRY]` (governing law)
- The dispute-resolution/arbitration clause in the Terms (per counsel)

Edit them in **both** places so the app pages and the standalone docs match:
- `src/pages/PrivacyPolicy.jsx` and `src/pages/TermsOfService.jsx` (constants near the top)
- `PRIVACY-POLICY.md` and `TERMS-OF-SERVICE.md`

## App-store / legal requirements these satisfy
- Google Play and the App Store both require a **publicly accessible Privacy Policy URL** — use `https://YOUR-DOMAIN/PrivacyPolicy`.
- Link both pages from your sign-up screen and footer.
- Complete the store **data-safety (Play)** and **privacy nutrition label (App Store)** forms to match this policy.
- Pair with `COMPLIANCE-AND-ASSUMPTIONS.md` for the deeper items (GDPR/CCPA consent capture, contest rules, money-transmitter review).

## Recommended next steps
1. Fill placeholders + legal review.
2. Add a consent checkbox linking these pages at sign-up.
3. Add a cookie/consent banner if serving EEA/UK users.
4. Publish official contest rules for the skill prize pool and feature votes.
