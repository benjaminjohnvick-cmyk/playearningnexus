// ai-disclosure.ts — AI-generated content disclosure layer for the creative / video pipeline.
//
// Two disclosure surfaces are applied to every AI-GENERATED creative and video:
//   1) a VISIBLE "AI-generated" label the renderer stamps on the asset (BrandedAd.jsx reads
//      `branding.ai_disclosure`); and
//   2) machine-readable PROVENANCE metadata in the C2PA / "Content Credentials" shape attached to the asset
//      (`content_credentials`), so platforms that read Content Credentials (TikTok, Meta, YouTube, LinkedIn)
//      can auto-label it, and the EU AI Act Art. 50 "machine-readable marking" expectation is supported.
//
// This is SEPARATE from the house brand watermark (ad-branding.ts): the watermark is your logo (branding); this
// is the required "this is AI-generated" disclosure. The visible label is ON by default (a compliance enabler,
// not a money/identity/legal action). Cryptographic C2PA SIGNING needs a signing CERTIFICATE — a specific
// external prerequisite — so it is GATED behind AI_DISCLOSURE_C2PA_CERT_CONFIGURED and stays OFF until a cert
// is configured; until then an UNSIGNED manifest is still attached (it declares provenance) and the visible
// label carries the disclosure to human viewers. Pure/deterministic. Not legal advice — see
// AI-CONTENT-DISCLOSURE-DESIGN.md and confirm platform/jurisdiction specifics with counsel.

import { snapBool, snapString } from "./settings.ts";
import { adBranding, type AdBranding } from "./ad-branding.ts";

export const aiDisclosureEnabled = () => snapBool("AI_DISCLOSURE_ENABLED", true);
export const aiDisclosureLabel = () => snapString("AI_DISCLOSURE_LABEL", "AI-generated");
export const aiDisclosurePosition = () => snapString("AI_DISCLOSURE_POSITION", "bottom-right");
export const aiDisclosureC2paEnabled = () => snapBool("AI_DISCLOSURE_C2PA_ENABLED", true);
/** Cryptographic C2PA signing requires a signing certificate — gated until one is configured. */
export const aiDisclosureCertConfigured = () => snapBool("AI_DISCLOSURE_C2PA_CERT_CONFIGURED", false);
export const aiDisclosureGenerator = () => snapString("AI_DISCLOSURE_GENERATOR", "Get Goods Gratis AI");

export interface AiDisclosureLabel { enabled: boolean; label: string; position: string; }
export interface ContentCredentials {
  "@context": string;
  claim_generator: string;
  format: string;
  signed: boolean;
  assertions: Array<{ label: string; data: Record<string, unknown> }>;
}
export interface DisclosureContext { kind?: string; tool?: string; model?: string; when?: string }

/** The visible "AI-generated" label spec the renderer stamps on the asset. */
export function aiDisclosureVisibleLabel(): AiDisclosureLabel {
  return { enabled: aiDisclosureEnabled(), label: aiDisclosureLabel(), position: aiDisclosurePosition() };
}

/** Build a C2PA / "Content Credentials"-shaped provenance manifest declaring the asset AI-generated. When no
 *  signing cert is configured the manifest is returned UNSIGNED (signed:false) — it still declares provenance;
 *  a cryptographically SIGNED manifest requires a C2PA certificate (AI_DISCLOSURE_C2PA_CERT_CONFIGURED). The
 *  digitalSourceType uses the IPTC "trainedAlgorithmicMedia" code, the standard marker for AI-generated media. */
export function buildContentCredentials(ctx: DisclosureContext = {}): ContentCredentials {
  const when = ctx.when || new Date().toISOString();
  return {
    "@context": "https://c2pa.org/schemas/v1",
    claim_generator: aiDisclosureGenerator(),
    format: ctx.kind === "video" ? "video" : "image",
    signed: aiDisclosureCertConfigured() && aiDisclosureC2paEnabled(),
    assertions: [
      {
        label: "c2pa.actions",
        data: {
          actions: [{
            action: "c2pa.created",
            digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
            softwareAgent: ctx.tool || aiDisclosureGenerator(),
            when,
          }],
        },
      },
      {
        label: "com.getgoodsgratis.ai",
        data: { ai_generated: true, tool: ctx.tool ?? null, model: ctx.model ?? null, generated_at: when },
      },
    ],
  };
}

/** House branding + the AI-generated visible label — for AI-GENERATED creatives only. */
export function brandingWithAiDisclosure(): AdBranding & { ai_disclosure?: AiDisclosureLabel } {
  const b = adBranding();
  return aiDisclosureEnabled() ? { ...b, ai_disclosure: aiDisclosureVisibleLabel() } : b;
}

/** Attach BOTH disclosure surfaces to a generated creative/video: the visible label (inside `branding`) and the
 *  Content-Credentials provenance manifest (`content_credentials`). Never mutates the input. */
export function applyAiDisclosure<T extends Record<string, unknown>>(
  creative: T, ctx: DisclosureContext = {},
): T & { branding: AdBranding & { ai_disclosure?: AiDisclosureLabel }; content_credentials?: ContentCredentials } {
  const existing = (creative.branding as AdBranding) || adBranding();
  const branding = aiDisclosureEnabled() ? { ...existing, ai_disclosure: aiDisclosureVisibleLabel() } : existing;
  const out = { ...creative, branding } as T & { branding: AdBranding & { ai_disclosure?: AiDisclosureLabel }; content_credentials?: ContentCredentials };
  if (aiDisclosureC2paEnabled()) out.content_credentials = buildContentCredentials(ctx);
  return out;
}

/** Admin-readable disclosure config (for the compliance surface). */
export function aiDisclosureConfig() {
  return {
    enabled: aiDisclosureEnabled(),
    visible_label: aiDisclosureVisibleLabel(),
    c2pa: {
      enabled: aiDisclosureC2paEnabled(),
      signed: aiDisclosureCertConfigured() && aiDisclosureC2paEnabled(),
      cert_configured: aiDisclosureCertConfigured(),
      generator: aiDisclosureGenerator(),
      note: aiDisclosureCertConfigured()
        ? "C2PA manifest is cryptographically signed."
        : "C2PA manifest attached UNSIGNED — declares provenance; configure a signing certificate to sign it.",
    },
  };
}
