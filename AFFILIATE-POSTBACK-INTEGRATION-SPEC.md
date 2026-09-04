# Affiliate-Network Postback Integration — Spec

*How a confirmed affiliate sale from a network (CJ, Rakuten/Rakuten Advertising, Impact, Awin, ShareASale,
Amazon) becomes a credited, clean-attributed reward in the closed loop. Pairs with the extension backend
(`extensionAffiliateReward`) and the extension client. Not legal advice. Prepared 2026-09-04.*

---

## 0. The shape of it

An affiliate network doesn't tell us about a sale in real time at checkout — it **confirms** the sale later
(after the merchant validates it), then fires a **server-to-server (S2S) postback** to a URL we register in the
network dashboard, OR exposes the conversion in a **reporting API** we poll. Either way, the confirmed
conversion lands on our side and is credited through `extensionAffiliateReward`, which already enforces the
clean-attribution rule and books `affiliate_commission` + the user's closed-loop points share.

```
User clicks our cashback link ──▶ merchant checkout ──▶ merchant validates sale
        │                                                        │
        ▼                                                        ▼
  (we recorded the click w/ our subid = user_id)     network confirms commission
                                                                 │
                                       S2S POSTBACK (or reporting API poll)
                                                                 │
                                                                 ▼
                              PUBLIC  affiliatePostback  (verify signature) 
                                                                 │  internal invoke
                                                                 ▼
                          extensionAffiliateReward  (clean attribution → credit points)
```

**The link between click and payout is the `subid`.** When the extension sends the user through our affiliate
deep link, we pass **our own user id as the network's sub-id parameter** (each network calls it something
different — see §3). The network echoes that sub-id back in the postback, so we know **which user** to credit.

---

## 1. The one backend piece to add — a public, verified postback endpoint

`extensionAffiliateReward` is intentionally **internal/admin-only** (it mints credit), so a network can't call
it directly. The missing link is a small **public** endpoint that (a) verifies the call really came from the
network, then (b) invokes `extensionAffiliateReward` internally. Recommended design:

**`affiliatePostback`** (public HTTP):
1. **Verify authenticity** — every network lets you include a **shared secret** in the postback URL and/or signs
   the request. Reject if the secret/signature doesn't match. Optionally allowlist the network's postback IPs.
2. **Dedupe** — key on the network's unique conversion/transaction id; ignore repeats (networks retry). Store
   seen ids (e.g., an `AffiliatePostback` row or a check against `AffiliateReferral`).
3. **Map fields** (§3) → call `extensionAffiliateReward` internally with `{ user_id (from subid), merchant,
   order_usd, commission_usd, network, existing_cookie_present, genuine_referral }`.
4. **Return 200** quickly (networks treat non-200 as failure and retry).

Ready-to-drop-in handler (matches the repo's patterns):

```ts
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapString } from "../../sdk/settings.ts";
import { extensionEnabled, extensionAffiliateEnabled } from "../../sdk/extension.ts";

// affiliatePostback (PUBLIC) — the network's verified S2S conversion callback. Verifies a shared secret, dedupes
// by the network's transaction id, then invokes the internal, credit-minting extensionAffiliateReward.
export default __handler(async (req) => {
  if (!extensionEnabled() || !extensionAffiliateEnabled()) return new Response("disabled", { status: 200 });
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k) ?? "";
  const secret = snapString("AFFILIATE_POSTBACK_SECRET", "");           // add this sensitive setting
  if (!secret || q("secret") !== secret) return new Response("forbidden", { status: 403 });

  const txId = q("txid") || q("cjevent") || q("irclickid") || q("order_id");
  if (!txId) return new Response("no txid", { status: 200 });
  // Dedupe: skip if we've already recorded this conversion.
  const seen = await db.filter("AffiliateReferral", { network_tx_id: txId }, "-created_date", 1).catch(() => []);
  if (seen && (seen as unknown[]).length) return new Response("dup ok", { status: 200 });

  const base44 = createClientFromRequest(req);
  await base44.functions.invoke("extensionAffiliateReward", {         // internal invoke → allowed by the guard
    user_id: q("subid") || q("sid") || q("u"),
    merchant: q("merchant") || q("advertiser") || url.hostname,
    order_usd: Number(q("sale") || q("amount") || 0),
    commission_usd: Number(q("commission") || q("payout") || 0),
    network: q("network") || "affiliate",
    network_tx_id: txId,
    existing_cookie_present: false,   // networks only pay US when WE won attribution, so this is false here
    genuine_referral: true,
  }).catch(() => null);
  return new Response("ok", { status: 200 });
});
```

Add one sensitive setting `AFFILIATE_POSTBACK_SECRET` (string, default "") and (optionally) a `network_tx_id`
field on `AffiliateReferral` for dedupe. *(Say the word and I'll wire this into the repo — it's ~1 function + 1
setting + 1 field.)*

---

## 2. Attribution: why `existing_cookie_present` is false at postback time

The clean-attribution guard runs at **two** moments:

- **Client-side, at click** (`content-shopping.js`): if another affiliate cookie/param is already present, we
  **don't** insert our link at all — so we never even start a referral we didn't earn.
- **Network-side, at payout**: the network only fires a commission postback to **us** when **we** were the
  attributed (usually last-click) publisher. If another publisher won, the network pays *them*, and we simply get
  no postback. So by the time a postback reaches us, attribution is already ours — `existing_cookie_present` is
  `false` and `genuine_referral` is `true`. The guard stays in `extensionAffiliateReward` as defense-in-depth.

This is the structural reason the model avoids the Honey problem: we never inject over an existing cookie
client-side, and we only ever receive (and credit) commissions the network already attributed to us.

---

## 3. Per-network field mapping

Register the postback URL as `https://<api>/functions/affiliatePostback?secret=<SECRET>&...` with the network's
macros. Names differ per network:

| Network | Sub-id param (send `user_id`) | Conversion macros the network appends | Notes |
|---|---|---|---|
| **CJ (Commission Junction)** | `sid` | `cjevent` (click/tx id), `amount`, `commission`, `advertiser` | S2S postback + "CJ event". Use `cjevent` as `txid`. |
| **Rakuten Advertising** | `u1` | order id, sales amount, commission | Signature-based S2S; map order id → `txid`. |
| **Impact** | `subId1` | `irclickid`, sale amount, payout, campaign | Robust S2S postbacks; `irclickid` → `txid`. |
| **Awin** | `clickref` | transaction id, sale amount, commission | S2S "conversion pixel"/API. |
| **ShareASale** | `afftrack` | transaction id, sale, commission | S2S notification. |
| **Amazon Associates** | — (no per-click subid; **no S2S postback**) | — | **Reporting API only.** Poll the Product Advertising / reports; you cannot per-user attribute reliably, so treat Amazon as pooled house revenue, not per-user cashback, or use a subtag scheme where allowed. |

For each, add a small mapping in `affiliatePostback` (or a per-network variant) translating its macro names into
the common `{ user_id, merchant, order_usd, commission_usd, txid }`.

---

## 4. Returns, reversals & clawback

Sales get **reversed** (returns, cancellations, fraud). Networks send a reversal postback or mark the line
reversed in reporting. Handle it:

- On a reversal postback, record a negative/void against the original `AffiliateReferral` (match on
  `network_tx_id`) and, if the user's points were already granted, **claw back** the points share (down to a
  floor of the user's current balance) — mirror the credit path in reverse.
- Because the user's share is a **subsidy** and the commission is the **revenue**, a reversal removes both from
  the ledger for accurate reporting.
- Consider a **hold window** (credit user points only after the network's return window clears) to minimize
  clawbacks — a setting like `AFFILIATE_CREDIT_HOLD_DAYS`.

---

## 5. Reconciliation (the safety net)

Postbacks can be missed. Run a scheduled **reconciliation** job that pulls the network's **reporting API** daily,
compares confirmed conversions to our `AffiliateReferral` rows, and fills any gaps (idempotently, keyed on
`network_tx_id`). This is the same pattern as the ops/order reconciliation already in the codebase.

---

## 6. Setup checklist

1. Add `affiliatePostback` + `AFFILIATE_POSTBACK_SECRET` + `network_tx_id` (§1). *(I can build this.)*
2. Join each network as a **publisher**; get your publisher/site ids and API keys.
3. In each network dashboard, set the **S2S postback URL** with the secret + macros (§3).
4. In the extension, build the affiliate **deep link** per merchant, passing `user_id` as that network's sub-id
   (§3), and keep the **clean-attribution** check (`content-shopping.js`).
5. Flip `EXTENSION_AFFILIATE_ENABLED` (and the master `EXTENSION_ENABLED`) — counsel-cleared — and test with a
   network's postback test tool.
6. Add the **reversal** handling (§4) and the **reconciliation** job (§5).

*Nothing earns until the networks are connected, the postback secret is set, and the gates are on. None of this
is legal clearance — confirm each network's publisher terms and the disclosure of cashback with counsel.*
