# Counsel review note — 2026-09-11 additions

**Purpose.** Two new passages were added to the packet in the 2026-09-11 work session and are marked *pending
counsel review*. This note isolates them and frames the specific questions for counsel so they can be cleared
(or revised) before they are treated as final. Nothing here changes the existing compliance spine — both were
drafted conservatively (capability/value-delivered framing, no revenue/ROI promise).

---

## 1. Founding "max-scale" feature entitlement (business/advertising-offer — legal)

**Where:** `FOUNDING-OFFER-LEGAL-REVIEW.md` §1 (new paragraph) and §6 (operator-controls list).

**What changed (verbatim):**
> "Max-scale feature entitlement (capability, not ad volume). In addition to the included features above, a
> founding advertiser is provisioned at the platform's highest (Tier 3 / Unlimited) capability level for every
> tier-gated product feature (e.g., maximum AI creative generations, all ad formats, unlimited concurrent
> experiments and multivariate testing, the full campaign-automation ceiling, and image/video/brand-kit/
> localization/auto-refresh tooling), at no additional charge, controlled by the operator flag
> `FOUNDING_MAX_SCALE_ENABLED` (default on). This is a product-feature/capability entitlement only; it does not
> increase the delivered ad-impression volume (the 200,000/yr allotment and its capacity-paced,
> deliver-until-met guarantee are unchanged), and it carries no revenue, sales, or ROI promise — it is
> additional advertising value delivered, framed strictly as features provided."

**Questions for counsel:**

1. **Presale consideration / value framing.** The founding offer is a non-refundable presale. Does granting the
   Tier-3/Unlimited *capability* level free to founders create any implied-value, "bait," or deceptive-comparison
   exposure relative to the paid Tier 2/Tier 3 price points? Is the "capability, not impression volume"
   distinction a sufficient and clearly-disclosed limit?
2. **Disclosure of operator toggle.** The entitlement is controlled by `FOUNDING_MAX_SCALE_ENABLED` (default on)
   and could, in principle, be turned off. Does the founding agreement need to disclose that included features
   may change, or should the entitlement be contractually fixed for the founding term once granted?
3. **"No revenue/sales/ROI promise" adequacy.** Is the existing disclaimer wording enough to keep this a
   features/"advertising value delivered" representation and not an earnings claim?
4. **Parity across the tier comparison.** Marketing now states PPC network advertising is included in all three
   tiers and founders get everything at max capability. Any UDAP/advertising-comparison concerns with how the
   tier table presents "included" vs "at maximum capability"?

---

## 2. Full-screen watch-gated AdGrid interaction (patent disclosure)

**Where:** `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md` new §1.16 (stamped "DRAFT — pending counsel /
patent-attorney review").

**What changed (verbatim):**
> "A single canonical PPC ad-grid survey surface (`AdGridSurvey`, to which all entry points lead) reworked as a
> full-screen experience: the shopper taps one tile in the grid and it opens a full-screen takeover in which the
> advertiser's video/audio creative loops continuously through a fixed 30-second watch gate (30s × 16 ads = 8
> minutes of metered attention); only when the gate clears do the survey questions appear beneath the
> still-looping ad, the shopper submits (credited server-side), the real product Buy-Now page reveals, and the
> shopper swipes — or uses on-screen arrows — straight to the next ad, so the entire multi-ad session is driven
> by a single grid tap. Candidate inventive angles: (C) the tap-once → looping watch-gate → questions-beneath →
> server-credited submit → swipe-to-next-ad interaction as one continuous full-screen unit; (A) the PPC network
> advertising feature is shared across all three advertiser tiers; and (B) the Founding tier receives the maximum
> (Tier 3) capability level of every feature, free (a capability grant, not an impression-volume grant)."

**Questions for patent counsel:**

1. **Novelty / claim scope.** Of the three flagged angles, which (if any) are patent-eligible subject matter and
   novel over prior art — particularly angle (C), the tap-once → looping watch-gate → questions-beneath →
   swipe-to-next interaction as one continuous unit?
2. **Prior-art landscape.** Rewarded-video and watch-to-unlock survey flows are well-trodden. Is a targeted
   prior-art search warranted before spending on a filing, and does the *specific combination* (continuous-loop
   gate + questions beneath the same still-playing creative + single-tap multi-ad swipe session) clear it?
3. **Business-model vs. technical.** Angles (A) shared-across-tiers and (B) founding-max-capability read as
   business-model choices. Should they be dropped from the patent track and kept purely as offer/marketing, or is
   there a technical implementation worth claiming?
4. **Timing vs. public disclosure.** Should a provisional be filed before the full-screen AdGrid is shown
   publicly (launch, demo, or marketing), to preserve rights? What is the disclosure-bar risk if it ships first?

---

## What is already conservative (context for counsel)

- Both passages avoid any revenue/earnings/ROI promise; the founding entitlement is framed as features/"advertising
  value delivered," not a return.
- The founding entitlement is explicitly **capability, not delivered ad-impression volume** — the 200,000/yr
  allotment and its capacity-paced, deliver-until-met guarantee are unchanged.
- The patent passage is explicitly marked **draft, not vetted for novelty or claim scope**, and defers eligibility
  entirely to counsel.

*Related packet docs: `FOUNDING-OFFER-LEGAL-REVIEW.md`, `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md`,
`LAWYER-CONVERSATION-GUIDE.md`, `FOR-YOUR-ATTORNEY.md`.*
