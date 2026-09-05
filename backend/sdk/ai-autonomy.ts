// ai-autonomy.ts — the ONE place that answers "may an AI process auto-apply a NON-SENSITIVE change right now?"
//
// It composes three things and nothing else:
//   1. the owner-delegated autonomy default for non-sensitive (auto_ok) domains (autonomyAutoOkDefault),
//   2. the "apply when the site is up and running" gate (SITE_LIVE + AI_APPLY_WHEN_LIVE), and
//   3. the global brakes (autonomy master switch, kill switch, AI pause, model engaged).
//
// It NEVER authorizes a sensitive or permanent-gate action. Those are decided elsewhere and stay hard walls:
//   • the Autonomy Kernel forces every permanent_gate domain (payout, refund, billing, KYC/tax, dispute,
//     account action, legal) to "manual" no matter what, and
//   • the optimizer's COMPLIANCE_DENYLIST + def.sensitive + priceLike checks keep money/price/legal knobs on
//     the human-approval path.
// This module only adds the *global* live/autonomy gate on top of those per-action walls — it can make the AI
// MORE conservative (advisory before launch), never less.

import { snapBool, snapString } from "./settings.ts";
import {
  autonomyEnabled, autonomyKillSwitch, autonomyAutoOkDefault, resolvePolicy,
} from "./autonomy-kernel.ts";
import { aiPaused } from "./ai-control.ts";

export const aiModelEnabled = () => snapBool("AI_MODEL_ENABLED", true);
export const siteIsLive = () => snapBool("SITE_LIVE", false);
export const applyWhenLive = () => snapBool("AI_APPLY_WHEN_LIVE", true);
export const aiModelTargetDate = () => snapString("AI_MODEL_TARGET_DATE", "2026-12-31");

export type AutoApplyMode = "apply" | "advisory" | "off";

/** The live auto-apply posture for NON-SENSITIVE AI actions:
 *  - "off":      a hard brake is on (model disengaged, autonomy off, or kill switch) — nothing automatic.
 *  - "advisory": autonomy is on but either non-sensitive autonomy isn't set to full, or the site isn't live
 *                yet and apply-when-live is set — the AI collects, learns, and recommends only.
 *  - "apply":    auto-apply non-sensitive actions (still within every per-action guardrail).
 *  Note: aiPaused() is checked by the async gate below (it does I/O); this sync read covers the settings brakes. */
export function autoApplyMode(): { mode: AutoApplyMode; reason: string } {
  if (!aiModelEnabled()) return { mode: "off", reason: "AI model is disengaged (AI_MODEL_ENABLED off)." };
  if (!autonomyEnabled()) return { mode: "off", reason: "Autonomy platform is off." };
  if (autonomyKillSwitch()) return { mode: "off", reason: "Global kill switch is ON — everything waits for a human." };
  if (autonomyAutoOkDefault() !== "full") return { mode: "advisory", reason: "Non-sensitive autonomy is not set to full — recommending only." };
  if (applyWhenLive() && !siteIsLive()) return { mode: "advisory", reason: "Site is not live yet — collecting, learning, and recommending until launch." };
  return { mode: "apply", reason: "Live and owner-delegated — auto-applying non-sensitive changes within all gates." };
}

/** Synchronous convenience: is the global gate open for a NON-SENSITIVE auto-apply? Callers still run their own
 *  sensitivity / denylist / permanent-gate checks — this only adds the global live/autonomy gate. */
export const canAutoApplyNonSensitive = (): boolean => autoApplyMode().mode === "apply";

/** Async convenience that also honors the human "stop" (aiPaused does a DB read). Prefer this where an await is
 *  already available; use the sync form only in pure/sync paths. */
export async function canAutoApplyNonSensitiveAsync(): Promise<boolean> {
  if (!canAutoApplyNonSensitive()) return false;
  return !(await aiPaused().catch(() => false));
}

/** For a specific Autonomy Kernel domain: auto-apply requires the global gate to be open AND the domain not to
 *  be a permanent gate AND to resolve to "full". */
export function domainAutoApplies(domainId: string, overrideMode?: string | null): boolean {
  if (!canAutoApplyNonSensitive()) return false;
  const p = resolvePolicy(domainId, overrideMode ?? null, autonomyAutoOkDefault());
  return !p.permanent_gate && p.mode === "full";
}
