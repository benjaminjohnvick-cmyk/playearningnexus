# AI-Generated Content Disclosure Layer — Design & Compliance Note

*Built 2026-09-06. Adds a required "this is AI-generated" disclosure to every AI-generated creative and video —
a **visible label** plus **machine-readable C2PA / Content-Credentials provenance metadata**. This is separate
from the house brand watermark (the logo). **Not legal advice** — the platform-policy and jurisdiction specifics
below change quarter to quarter; confirm them with counsel. The confirm-points at the end are for the attorney.*

## Why this exists (the requirement)

A brand watermark (your logo) is optional branding. An **AI-generated disclosure** is increasingly *required*,
and it is a different thing. Current landscape (verify with counsel):

- **Platforms** — YouTube, Meta/Instagram, TikTok, and LinkedIn require creators to disclose realistic
  AI-generated content, via a self-label and/or by reading embedded **C2PA "Content Credentials."** Stripping
  that metadata gets posts downranked or removed.
- **EU AI Act, Article 50** (effective **2026-08-02**) — providers must mark and disclose AI-generated video/
  image/audio, emphasizing **machine-readable** marking (embedded provenance), not just a visible caption.
- **New York synthetic-performer law** (effective **2026-06-09**) — ads using AI-generated "synthetic
  performers" (realistic fake humans) must disclose it conspicuously.
- **FTC** — no blanket "label all AI" mandate, but it bans deceptive AI use and (since 2024) fake AI reviews/
  testimonials; an ad must always also be identifiable *as an ad*.

Because platforms expect **both** a human-visible disclosure and machine-readable provenance, this layer
provides both.

## What was built

Two disclosure surfaces are attached to every AI-generated creative (AI Creative Suite) and every rendered
video (AI Video Engine):

1. **Visible "AI-generated" label.** The renderer (`BrandedAd.jsx`) stamps a small, plain label on the asset
   (default text **"AI-generated"**, default position bottom-right). It sits alongside — and is distinct from —
   the house brand watermark and the top website link. It's a disclosure, styled plainly, not branding.
2. **C2PA / Content-Credentials provenance manifest.** A machine-readable manifest is attached to the asset
   (`content_credentials`) declaring it AI-generated, using the standard IPTC **`trainedAlgorithmicMedia`**
   digital-source type and a `c2pa.created` action, plus the claim-generator name. Platforms that read Content
   Credentials can auto-label from this, and it supports the EU AI Act machine-readable-marking expectation.

### Signed vs. unsigned (the one gated piece)

A cryptographically **signed** C2PA manifest needs a signing **certificate** — a specific external
prerequisite. Until that cert is configured (`AI_DISCLOSURE_C2PA_CERT_CONFIGURED`, default OFF), the manifest is
attached **unsigned** — it still declares provenance, and the visible label still carries the disclosure to
humans. When the cert is in place, flip the flag and the manifest is marked signed. Nothing else changes.

## Components

- SDK: `backend/sdk/ai-disclosure.ts` — the visible-label spec, the C2PA manifest builder
  (`buildContentCredentials`), `brandingWithAiDisclosure()`, and `applyAiDisclosure()`. Pure/deterministic.
- Wired into: `aiCreativeSuiteGenerate` (each creative gets the label + manifest) and `aiVideoEngineRenderWinners`
  (each rendered video gets them).
- Renderer: `src/components/branding/BrandedAd.jsx` draws the visible label from `branding.ai_disclosure`.
- Admin read: `aiDisclosureStatus` — reports the config + a sample manifest (for counsel to inspect).
- Settings (Ad Branding): `AI_DISCLOSURE_ENABLED` (on), `AI_DISCLOSURE_LABEL` ("AI-generated"),
  `AI_DISCLOSURE_POSITION`, `AI_DISCLOSURE_C2PA_ENABLED` (on), `AI_DISCLOSURE_C2PA_CERT_CONFIGURED` (off — gated),
  `AI_DISCLOSURE_GENERATOR`.

## The visible label (what a viewer sees)

A small dark pill reading **"AI-generated"** in the corner of the creative, over the ad content, above the
house watermark. See the accompanying sample image (`AI-DISCLOSURE-LABEL-SAMPLE.png`) filed alongside this note.
The text and position are admin-tunable; keep the wording plain and truthful.

## For counsel to confirm

1. That the **visible label wording** ("AI-generated") and its **placement/conspicuousness** meet the applicable
   platform policies and the NY synthetic-performer "conspicuous disclosure" standard for the surfaces you post
   to. Some contexts may warrant "Made with AI" or a fuller statement.
2. That attaching an **unsigned** Content-Credentials manifest (until a signing cert is obtained) is acceptable
   as an interim posture, and advise on obtaining a **C2PA signing certificate** so the manifest can be signed.
3. Whether any surface additionally requires the **synthetic-performer** disclosure (realistic AI humans) beyond
   the generic "AI-generated" label, and the exact wording for that.
4. That this AI-content disclosure is **kept distinct from** the "this is an ad" disclosure (FTC ad
   identification) and the brand watermark — three separate things that can coexist on one creative.

*Cross-references: `AI-CREATIVE-SUITE.md`, `AI-VIDEO-ENGINE-SPEC.md`, `ad-branding.ts`,
`STRICTEST-STANDARD-COMPLIANCE-POLICY.md`, `SOCIAL-ADVERTISING-DISCLOSURE.md`, `FOR-YOUR-ATTORNEY.md`.*
