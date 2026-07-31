# Post-Deploy Smoke-Test Checklist

Run this against the live site after Railway finishes the build. Use one **test user** account and (for
the business parts) the **admin** account. Each item: what to do → what you should see → the knob if it's
off. Nothing here spends real money (card charging is off).

## 0. Deploy sanity (do first)

- [ ] **Build succeeded.** Railway shows a fresh deployment with today's timestamp, status "Active."
- [ ] **New tables exist.** In the DB (or admin), confirm `GroupGoal`, `GroupGoalReward`,
      `VerifiedSurveyMedia`, `RevenueEvent`, `BusinessAccount`, `BusinessSubscription`, `SponsoredPlacement`
      were created by `AUTO_MIGRATE=1`. (No error on first load = they're there.)
- [ ] **App loads**, you can log in, and the dashboard renders.

## 1. Tiered survey rewards

- [ ] Open the surveys area as a non-premium user. Copy reads **"12 points for every $1"** and
      **"complete $8 of surveys a day."**
- [ ] Complete (or simulate) a survey → you receive **points**, not cash. Balance goes up in points.
- [ ] The store stays **locked** until `survey_gross` for the day reaches **$8**, then unlocks.
- Knob: `SURVEY_POINTS_PER_DOLLAR` (12), `SURVEY_DAILY_GOAL_USD` (8), `SURVEY_PREMIUM_CASHBACK_PCT` (0.24).

## 2. Services marketplace section

- [ ] Marketplace → **Services** banner opens the Services page.
- [ ] The **category tiles** show (emerald gradient placeholders until the image job runs) with subsections.
- [ ] Tap a tile/subsection → the listings filter; "Clear filter" resets.
- [ ] Search works; buy/points/layaway buttons appear on service cards.
- Note: tiles fill with art after `aiServiceCategoryImages` runs (nightly, or trigger once from admin).

## 3. Auto-qualify → one-tap Premium

- [ ] As a user **below** the milestone: the "You've earned Premium!" banner does **not** show on the dashboard.
- [ ] (To test the positive path) seed `DailyEarnings` rows with `survey_gross ≥ 8` for ≥ `PREMIUM_AUTOQUALIFY_DAYS`
      (260) days, OR temporarily lower `PREMIUM_AUTOQUALIFY_DAYS` in admin → reload → the banner appears.
- [ ] Check the consent box → tap **Accept Premium** → success toast; you're now premium (surveys now pay cash back).
- Knob: `PREMIUM_AUTOQUALIFY_DAYS` (260). Requires `loyalty_program` flag ON (default).

## 4. Group goals (Dashboard → Groups tab)

- [ ] **Create** a goal (name, item, price) → you get an invite code.
- [ ] From a **second** test account, **join** with that code → both show as members.
- [ ] Each member's **own progress** shows; the summed bar moves as members earn (their `total_earnings` rises).
- [ ] At the milestone, the **Claim reward** button appears → claim → you receive the bonus **points**
      (platform-funded); claiming twice says "already claimed."
- Verify: nobody's points moved to anyone else — each keeps their own. Knob: `GROUP_GOAL_DISCOUNT_PCT` (0.10).

## 5. Verified surveys (a platform PPC survey, not BitLabs)

**Type-or-speak path (free, works with no OpenAI key):**
- [ ] Start a PPC survey → tap **"Type or speak your answers."**
- [ ] Type (or tap the phone keyboard mic to dictate) your answers → **Fill in my answers** →
      the review screen shows a matched option per question.
- [ ] Change one answer, then **Confirm & submit** → success (or "under review" if validity is low).

**Record path (needs `OPENAI_API_KEY` for the Whisper fallback):**
- [ ] Tap **"Record my voice"** → the biometric **consent** screen appears → agree → record → stop.
- [ ] On a supported browser (Android/desktop Chrome) it transcribes free on-device; otherwise Whisper.
- [ ] Review → submit. Confirm **no recording is stored** (VerifiedSurveyMedia row has `media_url: null`).
- Knob: `verified_surveys` flag (ON), `AUTOFILL_MATCH_MIN_CONFIDENCE` (0.5), `VERIFIED_SURVEY_MIN_VALIDITY` (50).

## 6. Cost levers (spot checks — mostly invisible/admin)

- [ ] **Moderation:** post a clean chat/forum message → it stays visible with no AI call (fast). Post an
      obvious scam/spam pattern → it's flagged/removed. (Ambiguous content still goes to the AI.)
- [ ] **Support triage:** a ticket with a clear keyword ("refund", "login") auto-routes without AI.
- [ ] **Translation:** switch UI language, load a page twice → second load is instant (cached, no re-translation).
- [ ] **Voice hint:** the "tap the mic to speak" hint shows under the AI support chat + catalog assistant.
- Knob: `MODERATION_BLOCK_TERMS` (add clear-cut terms), `AI_DAILY_SPEND_CAP_USD` (the global brake).

## 7. Business portal + revenue (open `/BusinessPortal`; use admin for the report)

- [ ] **Join as a business** → success; a `BusinessAccount` row is created.
- [ ] **Subscribe** to a tier → success; a `RevenueEvent` (`business_subscription`) is written.
- [ ] **Buy sponsored placement** — only works once `SPONSORED_PLACEMENT_PRICE_USD` > 0 (otherwise it
      correctly says "not priced yet"). Set a price in admin, retry → placement + `RevenueEvent` created.
- [ ] **Book an audience panel** — same: set `AUDIENCE_PANEL_PRICE_USD` > 0 first.
- [ ] **Seller cash-back (default `cashback` mode):** as user A, buy user B's member listing with points →
      user B is credited the **full list price + 10% cash-back points** (`SELLER_CASHBACK_POINTS_PCT`), the
      buyer paid no markup, and a **subsidy** `RevenueEvent` (`kind: "subsidy"`) is written. (Switch
      `MARKETPLACE_MARGIN_SOURCE` to `seller` for the commission mode, or `off` for neither.)
- [ ] **Seller cash-back is LOCKED until activation (default on):** after that member-listing sale, user B
      sees the sale proceeds in their **spendable** balance but the **10% cash-back is held** — user B gets a
      "cash-back waiting" notice and their `pending_cashback_points` rises (it is NOT in spendable `points`).
- [ ] **One-click activation:** as user B, open the **Business Upload** page → the emerald **"You have N
      cash-back points waiting"** banner shows → check the box → tap **Activate & unlock** → the held points
      move into spendable `points`, `seller_user_activated: true` is set with a `seller_user_commitment_until`
      one year out, and a `ConsentRecord` (`kind: "seller_user_activation"`) is written. After activation,
      future cash-back is spendable immediately.
- Knob: `SELLER_CASHBACK_REQUIRES_ACTIVATION` (on), `SELLER_USER_COMMITMENT_MONTHS` (12). Set the flag off to
  credit cash-back straight to spendable points with no gate.
- [ ] **Catalog spread:** buy a **platform-catalog** item with points → a `sourcing_margin` `RevenueEvent`
      is written (face value − wholesale). Buyer paid the normal price, not a markup.
- [ ] **Breakage report:** run `breakageReport` (admin) → shows outstanding vs redeemed points, the
      recognized breakage, the subsidies, and `coverage.covered: true` (breakage + advertiser pool cover the
      cash-back) → `seller_cashback_is_free: true`.
- [ ] **Revenue report:** run `revenueReport` (admin) → `recorded_revenue_usd` and `subsidies_usd` are
      separate, `net_after_subsidies_usd` shown, and **`customer_paid_usd = 0`** with `invariant_ok: true`.

## If something's off

- A feature "missing" → confirm its flag is ON in the admin panel (Compliance Flags).
- A business action says "not priced yet" → that's correct; set the price in the **Revenue** settings category.
- Voice recording won't transcribe → set `OPENAI_API_KEY` (type-or-speak still works without it).
- Tiles are blank → run `aiServiceCategoryImages` once from admin (or wait for the nightly job).
