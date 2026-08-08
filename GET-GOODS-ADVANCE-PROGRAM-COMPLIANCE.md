# Goods Advance Program — Compliance & Design (Get Goods Gratis)

**Status: DESIGN + DISABLED-BY-DEFAULT SCAFFOLD. Not launched. Not legal advice.**
This documents the *most compliant* structure for the optional in‑store advance we discussed, the
things we deliberately **excluded** because they are illegal or coercive, and the checklist that must
be satisfied **before** the feature may be enabled. Everything here is counsel‑gated: a licensed
consumer‑finance attorney and (if used) a sponsor bank must sign off before origination is turned on.

---

## 1. What the product is

An **optional, opt‑in, closed‑loop store advance**: an eligible member may draw up to a set cap
(**$2,920**, admin‑tunable) to buy goods/services **inside the Get Goods store only**, and repay it
over up to 12 months **from their own in‑app survey/PPC earnings**. It is a **consumer‑credit
product** and is regulated as such (Truth in Lending Act / Regulation Z; state lending or
retail‑installment law; ECOA/fair lending; CFPB UDAAP; FCRA if reported; BSA/AML/KYC).

The $2,920 cap corresponds to roughly one year of daily activity at the app's earn rate; it is a
**ceiling**, not an entitlement. Per‑member limits are set by ability‑to‑repay, not granted flat.

## 2. Compliant design decisions (what we KEEP)

- **Voluntary & opt‑in.** Never required to make a purchase. Members can always buy with earned
  balance (layaway / spend‑what‑you've‑earned) instead. The advance is one option, not a gate.
- **0% — no interest, no fees, no markup.** There is no finance charge, which avoids usury exposure
  and keeps the APR at 0%. (A markup or "tax" on the advance would be a finance charge that must be
  disclosed as APR and could breach state usury caps — so it is **not** used.)
- **Closed‑loop.** Spendable only in the Get Goods store; not an open‑loop card. (Does not remove
  consumer‑credit law, but removes open‑loop card‑network exposure.)
- **Ability‑to‑repay gating.** Eligibility requires a **demonstrated** earning history (a minimum
  number of active days and a trailing average daily earn rate) sufficient to plausibly repay the
  requested amount within the term. We underwrite on the **past**, never by compelling the future.
- **Non‑recourse from earnings.** Repayment draws only from the member's own future in‑app earnings.
  If they stop or fall short, the balance is **written off as a business loss** — there is no cash
  balloon, no charge to any card, and no referral to consumer collections. Default cost is bounded
  and pre‑priced.
- **TILA‑style disclosure + explicit consent.** Before any draw, the member sees amount, 0% APR,
  term, that repayment comes from their earnings, that nothing is owed in cash if they don't earn it,
  and that it will **not** be reported to credit bureaus (see below). Consent is recorded (version,
  timestamp, IP).
- **Repayment tracker (informational).** Projects payoff from the member's trailing earn rate and
  shows whether they're on pace. Nudges are **encouragement only** ("keep going" / optional voluntary
  pay‑down), never penalties.
- **Kill‑switch + per‑jurisdiction flags.** Ships behind the compliance feature‑flag layer
  (`goods_advance`, default **OFF**) so it can be disabled globally or per state instantly.

## 3. What we deliberately EXCLUDED (and why)

These were considered and **removed** because they are illegal or create serious consumer‑protection
liability. They are not in the code.

- **Lockout mode / mandatory daily use as a loan term.** Requiring labor (daily surveys) to discharge
  a debt has the hallmarks of **peonage / forced labor** (13th Amendment; 18 U.S.C. § 1581) and is a
  coercive/unfair practice (FTC, CFPB UDAAP). **Excluded.**
- **Mandatory backup credit card charged on default.** Card‑network rules broadly prohibit charging a
  card to repay a loan; surprise charges violate authorization rules (Reg E) and generate chargebacks
  that endanger the merchant account; auto‑charging stretched borrowers is a UDAAP harm. **Excluded.**
  (A *verified* payment method may be used as an underwriting/identity signal only — never auto‑charged.)
- **Forcing purchases through the advance / PPC flow.** Tying the ability to buy to the advance is
  coercive. Purchases remain freely payable with earned balance. **Excluded.**
- **Year‑end cash balloon + consumer collections.** Non‑recourse means no cash is demanded and no
  defaulted consumer is sent to collections. (Collections also recovers only pennies and is void if
  the loan wasn't lawfully originated.) **Excluded.**
- **Credit‑bureau reporting of defaults** (default posture): to avoid harming members' credit for a
  non‑recourse product. If a bureau‑reporting, recourse version is ever pursued, it becomes a
  different product requiring full FCRA furnisher compliance and counsel approval.

## 4. Lender of record / how it can go live

Two lawful paths; the feature stays OFF until one is fully configured **and** counsel signs off:

- **(A) Bank‑sponsored (recommended).** A partner bank is the lender of record (e.g., a
  Stripe‑style Consumer Credit Issuing program). Note: in that model the **platform funds the
  advances and bears the credit loss** (it purchases the receivables and posts reserves); the bank
  and processor provide the licensed rails, servicing, and disclosures. Requires the partner + program
  approval + capital/reserves.
- **(B) Self‑originated closed‑loop retail credit.** The platform is the creditor and must obtain
  state lending / retail‑installment‑seller licenses where required, hold the capital, and run TILA
  disclosures itself.

Either way, the platform's own conduct (marketing, eligibility, terms, fair lending, UDAAP, privacy,
KYC/AML) remains its responsibility; the processor's compliance does not confer immunity.

## 5. Pre‑launch checklist (ALL required before `goods_advance` may be turned on)

- [ ] Consumer‑finance counsel review of the full program + disclosures.
- [ ] Lender‑of‑record decided (bank partner approved, or state licenses obtained).
- [ ] Capital + loss‑reserve plan for the funded receivables (loss is the platform's).
- [ ] TILA/Reg Z disclosure copy approved; consent capture verified.
- [ ] Ability‑to‑repay policy approved (min history, trailing earn rate, per‑user limit formula).
- [ ] Fair‑lending (ECOA) and UDAAP review of eligibility + marketing.
- [ ] KYC/identity verification + BSA/AML/OFAC screening in place.
- [ ] Privacy review (financial data) + updated Terms/Privacy.
- [ ] Admin config set: `ADVANCE_PROVIDER` ≠ `none`, `ADVANCE_LEGAL_SIGNOFF` = true, cap confirmed.

## 6. Code footprint (all default‑off, provider‑gated)

- `backend/sdk/goods-advance.ts` — gate (`advanceProgramLive`), ability‑to‑repay, disclosure text,
  repayment projection. Refuses to originate unless flag ON **and** provider set **and** legal signoff.
- `backend/sdk/feature-flags.ts` — flag `goods_advance` (default OFF).
- `backend/sdk/settings.ts` — `ADVANCE_*` settings (cap $2,920, 0% APR, 12‑mo term, min history, etc.).
- `backend/db/*` — `GoodsAdvance` entity (owner‑scoped ledger, incl. disclosure record).
- `backend/functions/goodsAdvance{Eligibility,Accept,Tracker}` — read‑only eligibility/tracker;
  Accept is hard‑gated and no‑ops (returns "not available") until the checklist above is configured.
- `src/pages/GetGoodsAdvance.jsx` — opt‑in disclosure + tracker UI; shows "not available" when off.

---

*This is an internal design/compliance document, not legal advice. Do not enable origination without
written sign‑off from qualified consumer‑finance counsel and (if applicable) the sponsor bank.*
