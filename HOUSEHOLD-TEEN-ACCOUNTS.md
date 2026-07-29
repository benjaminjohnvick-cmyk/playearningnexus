# Family & Teens — household / approval accounts

An account structure modeled on **Amazon Household's teen-login flow**. One **adult account holder**
groups a small set of people under a household. Every member keeps their own login. Members are either:

- **Adult (18+)** — buys on their own, no approval needed.
- **Teen (13–17)** — every order is routed to the adult holder to **approve**, or **auto-approved** when
  the order is at/under a per-order spending limit the holder set for that teen.

## Compliance posture (read this first)

The platform is a **money-earning app with a hard 18+ floor** (`MIN_AGE` min 18; Terms, Privacy, and the
app-store rating are all 18+; COPPA / minor-contract law applies). Admitting under-18 teens is a genuine
legal change, not a feature toggle — so **teen enrollment is gated behind the `teen_accounts` feature
flag, which ships OFF** (the same safe-OFF pattern as `card_charging`).

- **While OFF:** adult household members work fully; teen invites are refused with a clear message. The
  entire teen approval flow is coded and dormant.
- **To turn ON** (requires, at minimum): verifiable parental consent, minor-data handling across the
  telemetry/AI systems, updated Terms/Privacy + app-store age rating, and **counsel sign-off**. Nothing in
  the code flips this flag automatically.

## Data model

`Household` document:

```
{ holder_id, name, members: [ { user_id, email, role: "adult"|"teen", spend_limit_usd, status, added_at } ] }
```

For O(1) purchase-time gating, each member's `User` row is also stamped with `household_id`,
`household_holder_id`, `household_role`, and `household_spend_limit_usd` — so the purchase flow never has to
scan households. `spend_limit_usd` is a **per-order auto-approve threshold** for teens (0 = every order
needs sign-off).

## Backend

- `backend/sdk/household.ts`:
  - `purchaseGate(user, orderUsd)` — pure/sync. Teen → needs approval unless the order is within the
    per-order limit; adults / non-members are never gated.
  - `memberStamp` / `clearStamp` — the User-row stamps written on add / remove.
  - `teenAccountsEnabled`, `householdMaxMembers`, `sanitizeName`.
- Functions (all registered in `_manifest.json`):
  - `householdCreate` — caller becomes the adult holder (18+ attestation required).
  - `householdAddMember` — add an existing account by email as adult or teen; teen requires the
    `teen_accounts` flag.
  - `householdStatus` — everything the page needs: holder view (members + pending approvals), member view,
    or "not in a household".
  - `householdSetLimit` — set a teen's per-order auto-approve limit.
  - `householdDecideOrder` — approve (→ `awaiting_payment`) or reject (→ `rejected`) a pending teen order.
  - `householdRemoveMember` — remove a member and clear their stamp.
- **Purchase gate** wired into `oneClickPurchase` and `purchaseMarketplaceListing`: a teen order that needs
  sign-off is logged as `status: "pending_approval"` **without claiming the listing or charging** (points
  or card). The holder approving in Family & Teens flips it to `awaiting_payment`. Nothing is charged or
  reserved while it waits.

## Frontend

- `src/pages/Household.jsx` — "Family & Teens" page: create a household (18+ attestation), add members
  (adult/teen + teen limit), edit teen auto-approve limits, remove members, and approve/decline pending
  teen orders. Teen options are disabled with an explanatory banner while `teen_accounts` is OFF.
- Nav entry **"Family & Teens"** in `src/Layout.jsx`.

## Flags & settings

- Flag: `teen_accounts` (**default OFF**).
- Settings: `HOUSEHOLD_MAX_MEMBERS` (default 6 — ~2 adults + 4 teens, like Amazon Household),
  `HOUSEHOLD_TEEN_MIN_AGE` (default 13).

## Honest note

The adult-only household + approval experience is safe to run today. Do **not** enable `teen_accounts`
until counsel has signed off on under-18 users for a money-earning app and the consent / minor-data /
legal-doc / app-store-rating work is done. I'm not a lawyer — this gate is deliberately conservative.
