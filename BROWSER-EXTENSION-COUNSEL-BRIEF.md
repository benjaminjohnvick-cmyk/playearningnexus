# Browser Extension ("Get Goods Gratis") — Counsel Brief

*Questions for our attorney on the Chrome/Edge browser extension, which is now **built (v1.0.0) and gated OFF**. This is the review-ready companion to the earlier design spec `BROWSER-EXTENSION-ATTENTION-REWARDS-DESIGN.md` (dated 2026-09-04, written before code): that document maps the design and its open questions; this brief packages the specific questions for counsel now that the extension exists as shipping code. Everything below is **built but disabled** — the master flag `EXTENSION_ENABLED` is sensitive, default 0, and counsel-gated (turning it on in the Setup Wizard requires a `COUNSEL_APPROVED` acknowledgment). Nothing is live in Chrome; we have not published to the Web Store. We are seeking sign-off before enabling and before we submit the listing.*

**Status:** The extension (`browser-extension/gg-extension`, Manifest V3, v1.0.0) is code-complete: new-tab and popup earn surfaces, an auth bridge that reads the signed-in session token on our own app origins, an opt-in shopping helper with clean affiliate attribution, options for the two consent layers, and a store-ready package. The backend endpoints it calls (`extensionConfig`, `extensionEnroll`, `extensionAdServe`, `extensionAdReward`, `extensionAffiliateReward`) all exist and are gated OFF server-side. The extension has **not** been submitted to the Chrome Web Store. We are not asking whether we *may* build it — it exists in a disabled state — but whether, and under what conditions, we may **enable** it and **publish** it.

*This is a request for attorney work-product / review. It is not legal advice and contains none.*

---

## 1. What the extension is (as built)

A Manifest V3 Chrome/Edge extension named **"Get Goods Gratis."** Users earn **non-cashable, closed-loop Site Cash** for viewing **our own** advertiser inventory on the extension's **new-tab** and **popup** surfaces, and earn **cashback** when they shop through affiliate links with **clean attribution** (we never override another party's affiliate cookie — the anti-"Honey" rule). It does **not** inject ads into, or read the content of, third-party pages.

Design constraints already enforced in code:

- **Minimal permissions at install.** Only `storage` and `scripting`. Host access is limited to our own two app origins (for the auth bridge). Broad host access (`https://*/*`) is `optional` and requested **only** when the user opts into the shopping helper or the browsing layer — never at install.
- **Auth bridge, our origins only.** A content script runs **only** on our app origins, copies the signed-in session token the app already stores (`localStorage['nexus_token']`) into extension storage so the extension can call our backend as the user, and clears it on sign-out. It reads nothing else and runs on no other site.
- **Own-inventory only.** The earn surfaces show our own `extension_eligible` advertiser creatives (or a house cross-sell when there is no paid inventory, which is never billed and never credited). A **5-second minimum view** is enforced before any reward.
- **Clean affiliate attribution.** The shopping helper runs on retailer pages **only after opt-in**; if another affiliate already owns attribution it does nothing (never overrides). Confirmed commissions are credited later by the network's verified server-side postback.
- **Rewards are closed-loop.** Site Cash is non-cashable on-platform store credit, credited through the existing balance/ledger path — no cash value, cannot be withdrawn.
- **Everything gated OFF.** `EXTENSION_ENABLED` (master, counsel-gated), plus `EXTENSION_REWARDS_DEFAULT_ENROLLED`, `EXTENSION_TRACKING_REQUIRE_OPTIN`, reward-per-impression and daily/lifetime cost caps.

Relevant docs: `BROWSER-EXTENSION-ATTENTION-REWARDS-DESIGN.md` (design + open questions), `AFFILIATE-POSTBACK-INTEGRATION-SPEC.md`, `PRIVACY-POLICY.md`, `COOKIE-AND-TRACKING-NOTICE.md`, `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`.

---

## 2. Questions for counsel (grouped)

### A. User consent — the two-layer split
The design splits user consent into **Layer A** (reward enrollment: earn on *our* extension surfaces, default-ON/opt-out after the user's manual install) and **Layer B** (any browsing/attention layer that reads the pages the user visits: explicit opt-IN, globally, with the broad host permission requested only at that moment).

1. Is **install + the Chrome permission prompt** an adequate consent basis for Layer A (first-party ad serving on surfaces we control, no cross-site tracking), with default-on enrollment and a one-tap opt-out — the same posture as our in-app default-on ad units?
2. Is our **global opt-in** for Layer B (rather than EU-only) sufficient for GDPR/CCPA profiling-consent purposes, and is the separate on-its-own-screen disclosure + the just-in-time broad-permission request the right mechanics?
3. Confirm the **privacy-policy disclosures and Chrome "Limited Use" representations** we must make for the host permissions, and whether our current `PRIVACY-POLICY.md` / `COOKIE-AND-TRACKING-NOTICE.md` language covers the extension specifically.

### B. The auth bridge (session-token pickup)
The extension reads the signed-in session JWT from our own app's `localStorage` on our own origins and stores it in extension storage to call our backend as the user.

4. Any consent, disclosure, or data-security concern with the extension reading the user's **own** session token on **our own** origins to act as that authenticated user? Should this be called out explicitly in the extension's privacy disclosure and store listing, and are there token-handling/retention practices you want us to commit to?

### C. Affiliate attribution — the anti-"Honey" posture
Honey's exposure came from attribution hijacking (injecting its own affiliate cookie to claim credit for sales it didn't drive). We enforce the opposite in code: never override an existing affiliate cookie; only claim genuine referrals; respect last-click/creator attribution; disclose the commission to the user.

5. Are the **clean-attribution rules as built** sufficient to keep us clear of the Honey-style tortious-interference / unfair-competition / commission-diversion theories, and is there anything in the mechanics (only attaching where none exists, server-side verified postback) you want changed or documented?
6. Do each affiliate network's **publisher terms** and any FTC affiliate-disclosure rules require specific in-extension disclosure wording at the point the shopping prompt appears?

### D. Chrome Web Store policy & publication
The extension has not been submitted. It is own-inventory only, no third-party injection, minimal install permissions.

7. Before we submit, please confirm the **surfaces/permissions model passes Chrome Web Store review** and the extension is not classifiable as ad injection / adware, and confirm the **Limited Use** and single-purpose disclosures the listing must carry.
8. Any concern with the **new-tab override** (replacing the browser's new-tab page with our earn surface) as a disclosed, opt-out-able feature under current store policy?

### E. Rewards / closed loop
Users are paid only in non-cashable, closed-loop Site Cash; real money reaches the platform only from our advertisers (by contract) and affiliate networks (whose merchants already agreed to pay).

9. Confirm that crediting **non-cashable Site Cash** for extension ad views and affiliate purchases does **not** create a cash-equivalent, a stored-value/money-transmission issue, or a sweepstakes/lottery concern in the extension context — the same closed-loop posture already reviewed for the core platform.

### F. Advertiser inventory clause
Our advertiser agreement carries an **extension-inventory clause** (default-on, opt-out, B2B, disclosed, logged in the consent ledger) so the extension always has our own inventory to show; each campaign has an `extension_eligible` flag.

10. Is the **default-on, opt-out, affirmatively-agreed, disclosed** B2B clause acceptable (tying is not realistically in play as a new entrant with no market power), and is the consent-ledger capture of the accepted clause version the right evidence to keep?

### G. Minors / 18+
The platform is 18+.

11. Given a browser extension is installed at the browser level, is there any **incremental age-assurance** obligation beyond the platform's existing gate, and any exposure if a minor installs it and views ad inventory?

---

## 3. Recommendation pending review

- Keep **`EXTENSION_ENABLED` OFF and counsel-gated** (already implemented — enabling it in the Setup Wizard requires `COUNSEL_APPROVED`), and **do not submit to the Chrome Web Store** until counsel clears both the enable and the publication.
- Have counsel confirm the **Web Store permissions/policy posture** (§D) before submission, since a rejected or removed listing is costly to unwind.
- Implement counsel's required **disclosure wording** for: the shopping-helper commission prompt (§C6), the Layer B opt-in screen and privacy/Limited-Use language (§A), and the auth-bridge disclosure (§B).
- Confirm the **closed-loop Site Cash** posture (§E) carries over to the extension unchanged, and the **advertiser inventory clause** wording (§F).
- Only after sign-off: flip `EXTENSION_ENABLED` via the Setup Wizard, connect the affiliate-network publisher accounts, and publish the listing.

*None of this is legal clearance — it is an organized map of the built extension and its open questions so counsel can review efficiently before the master flag is enabled and before we publish.*
