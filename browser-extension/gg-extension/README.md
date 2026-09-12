# Get Goods Gratis — Browser Extension (`gg-extension`)

A Manifest V3 Chrome/Edge extension. Users earn **non-cashable Site Cash** for viewing **our own** advertiser
inventory on the extension's **new-tab** and **popup** surfaces, and get **cashback** when they shop — with
**clean affiliate attribution** (we never override another party's affiliate cookie — the anti-"Honey" rule).

**Status: complete (v1.0.0).** Auth bridge, config/enroll/serve/reward wiring, 5-second view gate, popup +
options (rewards opt-out, shopping helper, off-by-default personalization, advanced backend/affiliate config),
background worker, content scripts, and icons are all in place.

## How it works

- **Auth bridge (`content-auth.js`).** Runs only on our app origins. When the user is signed in on the site,
  the app stores a session JWT in `localStorage['nexus_token']`; the bridge copies it into
  `chrome.storage.local.authToken` so the extension can call the backend as the user (`Authorization: Bearer`).
  It clears the token on sign-out. If the user isn't signed in, the surfaces show a "sign in on the site" state.
- **New-tab (`newtab.html/js`).** User taps **Watch to earn** → `extensionAdServe` returns one of our own
  creatives (or a house cross-sell) → a **5-second minimum view** → `extensionAdReward` credits Site Cash
  (server enforces the daily/lifetime caps). House cross-sells aren't paid impressions, so they don't credit.
- **Popup (`popup.html/js`).** Quick status + the rewards opt-out toggle + open-new-tab.
- **Options (`options.html/js`).** Rewards opt-out (Layer A, default on); the **shopping helper** (requests an
  optional host permission at opt-in, registers `content-shopping.js`); **personalized offers** (Layer B,
  off by default, explicit opt-in + broad permission + consent); and **Advanced** (backend URL for a custom
  domain, affiliate redirect base once a cashback network is connected).
- **Shopping helper (`content-shopping.js`).** Runs on retailer pages **only after opt-in**. Shows our own
  cashback prompt; if another affiliate already owns attribution it does nothing (never overrides). On a genuine
  activation it routes through the configured affiliate redirect (if set); the confirmed commission is credited
  later by the network's verified postback → `extensionAffiliateReward` (server-side).
- **Background (`background.js`).** Opens settings on install, marks the install once the user first signs in,
  and (un)registers the shopping helper on opt-in/out.

## Backend endpoints used

`extensionConfig`, `extensionEnroll`, `extensionAdServe`, `extensionAdReward` (all authenticated via the Bearer
token). `extensionAffiliateReward` is server-side only (called by the affiliate network's postback). Everything
is gated OFF by default server-side (`EXTENSION_ENABLED` etc.) until you turn it on.

## Load / test (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `gg-extension` folder.
2. Sign in on the site (a matched app origin). Open a new tab — the earn surface should show your status.
3. If you use a custom domain, add it to `manifest.json` (`host_permissions` **and** `content_scripts.matches`)
   and set the **Backend URL** in the extension's Settings.

## Package for the Chrome Web Store

Zip the folder contents (not the parent folder):

```
cd gg-extension && zip -r ../gg-extension.zip . -x ".*"
```

Upload the zip in the Chrome Web Store Developer Dashboard. Set `EXTENSION_WEBSTORE_URL` in the app settings so
the in-app install prompt links to your listing.

> Site Cash is non-cashable, on-platform store credit — no cash value, cannot be withdrawn.
