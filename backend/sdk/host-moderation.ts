// host-moderation.ts — the AI MODERATION LAYER for live hosting. It is exactly that: a layer that catches
// illegal / infringing / harmful content fast (rules-first free, then the cheap Llama tier for the ambiguous
// middle), kills the stream on a block, auto-suspends on viewer reports, and tracks repeat-infringer strikes.
//
// IMPORTANT (legal): this LAYER complements, and never replaces, the registered DMCA designated agent + the
// notice-and-takedown process (dmcaTakedownRequest). Those are a legal registration/safe-harbor requirement; AI
// moderation is operational risk reduction. The repeat-infringer STRIKE count here is what feeds the DMCA
// repeat-infringer termination policy — so the two work together.

import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";

export const aiModerationEnabled = () => snapBool("HOSTING_AI_MODERATION_ENABLED", true);
export const killOnBlock = () => snapBool("HOSTING_MODERATION_KILL_ON_BLOCK", true);
export const reportThreshold = () => Math.max(1, Math.round(snapNumber("HOSTING_MODERATION_REPORT_THRESHOLD", 3)));
export const repeatInfringerLimit = () => Math.max(0, Math.round(snapNumber("HOSTING_REPEAT_INFRINGER_STRIKES", 3)));
export const visionModerationEnabled = () => snapBool("HOSTING_MODERATION_VISION_ENABLED", false);

// Categories the moderation layer blocks on (illegal, infringing, adult, harmful).
export const BLOCK_CATEGORIES = ["illegal", "copyright_infringing", "sexual", "violence", "hate", "harassment", "scam"] as const;
export type ModCategory = typeof BLOCK_CATEGORIES[number];

export interface HostModVerdict {
  action: "allow" | "warn" | "block";
  categories: string[];
  severity: "low" | "medium" | "high" | null;
  reason: string | null;
  via: "rules" | "ai" | "skipped";
}

/** Parse a lenient AI moderation JSON result into a verdict. Pure. */
// deno-lint-ignore no-explicit-any
export function verdictFromAi(r: any): HostModVerdict {
  const flagged = r?.is_flagged === true || r?.action === "remove" || r?.action === "block" || r?.is_safe === false;
  const sev = (["low", "medium", "high"].includes(String(r?.severity)) ? r.severity : (flagged ? "high" : null)) as HostModVerdict["severity"];
  const cats = Array.isArray(r?.categories) ? r.categories.map(String) : (r?.category ? [String(r.category)] : []);
  return {
    action: flagged ? (sev === "low" ? "warn" : "block") : "allow",
    categories: cats,
    severity: sev,
    reason: r?.reason ? String(r.reason) : null,
    via: "ai",
  };
}

/** How many upheld strikes a host has (moderation blocks + DMCA takedowns). Audit-based repeat-infringer count. */
export async function hostStrikeCount(hostId: string): Promise<number> {
  if (!hostId) return 0;
  return Number(await db.count("HostModerationEvent", { host_player_id: String(hostId), strike: true }).catch(() => 0)) || 0;
}

/** A host is barred from hosting once strikes reach the limit (the DMCA repeat-infringer termination policy). */
export async function isHostBlocked(hostId: string): Promise<boolean> {
  const lim = repeatInfringerLimit();
  if (lim <= 0) return false;
  return (await hostStrikeCount(hostId)) >= lim;
}

/** Record a moderation event (the audit trail the repeat-infringer policy relies on). */
export async function recordModEvent(ev: {
  session_id?: string; host_player_id?: string; type: "scan" | "block" | "report" | "strike" | "takedown";
  action?: string; categories?: string[]; severity?: string | null; reason?: string | null; actor?: string; strike?: boolean;
}): Promise<void> {
  await db.create("HostModerationEvent", {
    session_id: ev.session_id ?? null,
    host_player_id: ev.host_player_id ?? null,
    type: ev.type,
    action: ev.action ?? null,
    categories: ev.categories ?? [],
    severity: ev.severity ?? null,
    reason: ev.reason ?? null,
    actor: ev.actor ?? null,
    strike: ev.strike === true,
    at: new Date().toISOString(),
  }).catch(() => null);
}

/** Build the moderation prompt for the ambiguous middle (only reached when rules-first says "review"). */
export function hostModerationPrompt(text: string, context: string): string {
  return `You are moderating LIVE-STREAM ${context} on a shopping platform. Flag content that is illegal, ` +
    `copyright-infringing, sexual, violent, hateful, harassing, or a scam.\n` +
    `Content: "${String(text).slice(0, 400)}"\n` +
    `Respond as JSON: is_flagged (boolean), categories (array of strings), severity (low|medium|high|null), reason (string|null).`;
}
