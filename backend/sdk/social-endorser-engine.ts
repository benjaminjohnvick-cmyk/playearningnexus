// social-endorser-engine.ts — the AI social-post ENGINE for the paid-endorser program.
//
// This is the "personalize the platform's best ad for each opted-in member and post it to their socials"
// layer the owner described, built as the MOST LEGAL/COMPLIANT version and gated OFF by default. It sits on
// top of the pieces that already exist (OAuth-connected accounts, ppc_social_ads_opt_in, the #ad disclosure
// helper, the autonomy kernel) and adds three things: (1) an ELIGIBILITY gate so only consented, connected
// members ever get a post, (2) a PERSONALIZATION prompt builder that turns an advertiser's approved creative
// into member/platform-native copy with a MANDATORY #ad disclosure and hard no-false-claims rules, and
// (3) an AUTONOMY decision so posting starts human-approved (draft) and only becomes automatic once the
// "social" domain has earned trust AND the owner has explicitly switched autopost on.
//
// COMPLIANCE SPINE (unchanged):
//   • Opt-in + consent required. No member is ever posted to without ppc_social_ads_opt_in and an active
//     connection. Disclosure (#ad · Sponsored) is enforced on EVERY generated post — it cannot be stripped.
//   • Value delivered, never guaranteed income. The reward (endorser-rewards.ts) is a share of a MEASURED
//     conversion — this engine only creates the post; it promises nothing to the member.
//   • Auto-posting is a permission the OWNER grants, gated behind the autonomy kernel's "social" domain
//     (manual → earned → full) AND a master ENDORSER_AUTOPOST_ENABLED flag AND the global kill switch. Off →
//     every post is a DRAFT a human approves. Nothing posts to a member's account automatically until the
//     owner turns both on, after counsel.
//   • Everything here is inert while the program is disabled — callers create drafts only.

import { snapBool } from "./settings.ts";
import { withAdDisclosure, AD_DISCLOSURE } from "./disclosure.ts";
import { resolvePolicy, autonomyDecision, currentThresholds, autonomyKillSwitch, type TrustSignals } from "./autonomy-kernel.ts";

// ── Config (all OFF/strict by default — PENDING COUNSEL) ────────────────────────────────────────────────
/** Master switch for generating AI-personalized endorser posts at all. OFF by default. */
export const endorserPersonalizeEnabled = () => snapBool("ENDORSER_PERSONALIZE_ENABLED", false);
/** Master switch that ALLOWS auto-posting to a member's account (still also gated by the autonomy kernel +
 *  kill switch). OFF by default → every post is a human-approved draft, no exceptions. */
export const endorserAutopostEnabled = () => snapBool("ENDORSER_AUTOPOST_ENABLED", false);
/** Require explicit opt-in before any post is generated for a member. ON by default (never turn off). */
export const endorserOptInRequired = () => snapBool("ENDORSER_OPT_IN_REQUIRED", true);

// ── Eligibility (pure) ──────────────────────────────────────────────────────────────────────────────────
export interface EndorserMember {
  id?: string;
  ppc_social_ads_opt_in?: boolean;   // the existing opt-in flag
  endorser_opt_in?: boolean;         // optional explicit endorser-program opt-in (extra consent layer)
  active_connections?: number;       // count of active SocialMediaConnection rows
  suspended?: boolean;               // moderation / abuse hold
}

export interface Eligibility { eligible: boolean; reason: string; }

/** Can we generate/post an endorser ad for this member? Consent + a live connection + not suspended.
 *  `optInRequired` defaults to the setting; pass explicitly in tests. Pure. */
export function endorserEligibleToPost(m: EndorserMember, optInRequired = endorserOptInRequired()): Eligibility {
  if (!m || m.suspended === true) return { eligible: false, reason: "member suspended / on hold" };
  const optedIn = m.ppc_social_ads_opt_in === true || m.endorser_opt_in === true;
  if (optInRequired && !optedIn) return { eligible: false, reason: "no social-ads opt-in / consent on file" };
  if ((Number(m.active_connections) || 0) <= 0) return { eligible: false, reason: "no active social connection" };
  return { eligible: true, reason: "opted-in, connected" };
}

// ── Personalization prompt (pure) ───────────────────────────────────────────────────────────────────────
export interface CreativeInput {
  advertiser_name?: string;
  approved_copy: string;             // the advertiser's APPROVED base creative (never invent claims beyond it)
  offer?: string;                    // e.g. "20% off first order"
  landing_url?: string;
}
export interface MemberVoice {
  platform: string;                  // instagram | tiktok | x | facebook | linkedin | youtube
  tone?: string;                     // optional member-preferred tone, if they set one
  niche?: string;                    // optional audience niche
}

/** Build the LLM prompt that adapts an advertiser's APPROVED creative into copy native to one member +
 *  platform. Hard rules baked in: keep to the approved claims (no new/exaggerated claims), keep it truthful,
 *  and ALWAYS include the disclosure tag. The engine still re-enforces disclosure after generation, so this
 *  is belt-and-suspenders. Pure — returns the prompt string. */
export function personalizationPrompt(creative: CreativeInput, voice: MemberVoice, disclosureTag = AD_DISCLOSURE): string {
  const platform = String(voice.platform || "social").toLowerCase();
  return [
    `You are adapting an ADVERTISER-APPROVED ad into a short post that feels native to ${platform}.`,
    `Advertiser: ${creative.advertiser_name || "the advertiser"}.`,
    `Approved base copy (do NOT add claims, prices, results, or guarantees beyond what is here):`,
    `"""${creative.approved_copy}"""`,
    creative.offer ? `Offer to mention accurately: ${creative.offer}.` : ``,
    creative.landing_url ? `Include this link once: ${creative.landing_url}.` : ``,
    voice.tone ? `Match this tone: ${voice.tone}.` : `Keep the tone friendly and authentic.`,
    voice.niche ? `The poster's audience: ${voice.niche}.` : ``,
    `HARD RULES:`,
    `- Truthful only. Never invent benefits, statistics, earnings, or outcomes.`,
    `- No income, earnings, or "get rich" claims of any kind.`,
    `- Keep it concise and platform-appropriate; a few relevant hashtags are fine.`,
    `- You MUST include the disclosure "${disclosureTag}" so it is clear and conspicuous (FTC).`,
    `Return ONLY the post text.`,
  ].filter(Boolean).join("\n");
}

/** Final guarantee that the disclosure is present, regardless of what the model returned. Never returns copy
 *  without the #ad disclosure. Pure (delegates to the shared disclosure helper). */
export function enforceDisclosure(text: string): string {
  return withAdDisclosure(String(text ?? ""));
}

// ── Post-mode decision (pure) ───────────────────────────────────────────────────────────────────────────
export type PostAction = "draft" | "autopost";
export interface PostModeResult { action: PostAction; auto: boolean; reason: string; }

/** Decide whether a generated post should be AUTO-POSTED or held as a human-approved DRAFT. Auto-posting
 *  requires ALL of: the master autopost flag ON, the personalize program ON, the autonomy "social" domain
 *  clearing its gate (mode full, or earned with trust), and the kill switch OFF. Anything short → draft.
 *  Pure — takes the trust signals + flags so it is fully unit-testable. */
export function decidePostMode(
  trust: TrustSignals,
  opts: { personalizeEnabled: boolean; autopostEnabled: boolean; overrideMode?: string | null; killSwitch?: boolean },
): PostModeResult {
  if (!opts.personalizeEnabled) return { action: "draft", auto: false, reason: "endorser posting disabled (pending counsel) — draft only" };
  if (!opts.autopostEnabled) return { action: "draft", auto: false, reason: "auto-posting off — human approves every post" };
  const policy = resolvePolicy("social", opts.overrideMode ?? null);
  const decision = autonomyDecision(policy, trust, currentThresholds(), opts.killSwitch ?? false);
  return decision.auto_approve
    ? { action: "autopost", auto: true, reason: decision.reason }
    : { action: "draft", auto: false, reason: decision.reason };
}

/** Convenience wrapper reading the live flags + kill switch. Impure (reads settings). */
export function decidePostModeLive(trust: TrustSignals, overrideMode?: string | null): PostModeResult {
  return decidePostMode(trust, {
    personalizeEnabled: endorserPersonalizeEnabled(),
    autopostEnabled: endorserAutopostEnabled(),
    overrideMode,
    killSwitch: autonomyKillSwitch(),
  });
}
