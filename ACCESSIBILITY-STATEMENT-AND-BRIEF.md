# Accessibility Statement & Compliance Brief — Get Goods Gratis (Free)

> **⚠️ DRAFT — NOT LEGAL ADVICE.** Two documents in one: **Part A** is a public **Accessibility Statement**
> template (user-facing), and **Part B** is a **compliance brief** for counsel + engineering on the platform's
> web/app accessibility obligations and how to meet them. Consumer websites and apps are a frequent target of
> **ADA Title III** web-accessibility claims in the U.S., so this is a real, commonly-overlooked exposure.
> Bracketed items **[LIKE THIS]** are decisions for counsel/owner. Prepared 2026-09-13.

---

# Part A — Accessibility Statement (public template)

**Get Goods Gratis is committed to making our website and apps accessible to everyone, including people with
disabilities.** We aim to conform to the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** across the
website/PWA and our mobile apps, and we work to maintain and improve accessibility over time.

**What we do:** we design for keyboard operability, sufficient color contrast, text alternatives for images,
labels for form controls, captions/labels for media where applicable, and compatibility with common assistive
technologies (screen readers, magnification, voice control).

**Feedback and help:** if you encounter a barrier or need content in an alternative format, contact us at
**[accessibility contact email]** and we will work with you to provide the information or complete the
transaction through an accessible alternative. **[Owner: staff a response path + target response time.]**

**Ongoing:** accessibility is not a one-time project; we test periodically and remediate issues we find or that
are reported to us. This statement was last updated **[date]**.

---

# Part B — Compliance brief (for counsel + engineering)

## 1. Why this matters (the exposure)

- **U.S. — ADA Title III.** Many courts treat consumer websites/apps of businesses as "places of public
  accommodation" (or as sufficiently connected to goods/services), and **web-accessibility demand letters and
  lawsuits are extremely common**; **WCAG 2.1 AA** is the de facto standard courts and settlements reference.
  There is no single federal web-accessibility regulation, so the standard is set by case law and consent
  decrees. **[Counsel: confirm the current posture in the platform's likely venues.]**
- **U.S. — state laws** (e.g., California Unruh Act) can add statutory damages and are frequently pleaded
  alongside the ADA.
- **EU — European Accessibility Act (EAA)** obligations for e-commerce came into effect **June 2025**; if the
  platform sells into the EU, EN 301 549 / WCAG-aligned conformance is expected. **[Counsel: scope by market.]**
- **Canada (AODA/ACA)** and other regimes may apply depending on where you operate.
- **Section 508** applies only if selling to U.S. federal government — likely N/A, confirm.

## 2. Current state (needs an audit)

The platform has **not yet had a formal accessibility audit**. Conformance to WCAG 2.1 AA is currently
**[unknown — to be measured]**. This brief does not assert a conformance level; it sets the path to establish
and maintain one.

## 3. Path to conformance

1. **Automated scan** of key flows (signup/age gate, shop/checkout, earn/survey, ad-grid, account/privacy,
   legal pages) to catch the common issues (contrast, labels, alt text, focus order, ARIA).
2. **Manual + assistive-tech audit** of the same flows (keyboard-only, screen reader, zoom/reflow), since
   automated tools catch only a fraction of WCAG criteria.
3. **Remediate** by severity; bake accessibility into the component library so fixes hold.
4. **Publish** the Part A statement with a **real feedback path** (a monitored contact + response SLA — a
   staffed feedback channel is itself a mitigating factor in ADA disputes).
5. **Regression-test** accessibility in QA (add checks to `QA-TEST-PLAN.md`) and re-audit on major UI changes.
6. **[Optional] VPAT / conformance report** if enterprise/government buyers request one.

## 4. Special considerations for this platform

- **Ad-grid full-screen takeover + watch-gate** — timed/looping media and swipe interactions need accessible
  equivalents (pause/controls, keyboard/AT operability, no reliance on color/motion alone). **[Priority flow.]**
- **Voice notes (Buddy Chat)** — provide text alternatives/transcripts (already produced for moderation) to
  support hearing-impaired users.
- **AI-generated category artwork** — ensure meaningful **alt text**, not decorative-only, where it conveys
  information.
- **Age gate / jurisdiction gate / consent banner** — these block entry, so they must be fully accessible or
  they block disabled users entirely.

## 5. Questions to finalize (for counsel)

1. **Target standard + markets** — confirm WCAG 2.1 AA (vs. 2.2) and which regimes apply (ADA, state, EAA,
   AODA) given the launch footprint.
2. **Statement wording** — approve Part A, including how strongly to assert conformance (avoid over-claiming a
   level not yet audited).
3. **Feedback/response SLA** — set and staff it.
4. **Audit scope + cadence** — which flows, how often, and who signs off.
5. **Contractual flow-down** — do third-party components/embeds (payment, survey, streaming) meet the standard,
   and should vendor contracts require it?

*This is a draft template + brief, not legal advice, and is not a substitute for review and finalization by a
licensed attorney and a qualified accessibility auditor. Related: `QA-TEST-PLAN.md`,
`GLOBAL-COMPLIANCE-AND-LOCALIZATION.md`.*
