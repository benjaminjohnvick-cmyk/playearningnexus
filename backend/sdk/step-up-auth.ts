// step-up-auth.ts — server-side STEP-UP AUTH for sensitive actions (the "device proposes, server disposes"
// gate). Before any balance-affecting or identity/legal action (payout, purchase, KYC, account change), the
// server requires a FRESH, strong re-authentication and re-validates the action itself — so the sensitive core
// stays un-cheatable even though the app runs on the user's own device.
//
// Method-agnostic so it works on ANY smartphone:
//   • "passkey"     — WebAuthn/passkey: the device's own biometric/PIN, verified cryptographically. NO biometric
//                     data ever reaches the server (best security, least liability). Primary where available.
//   • "password"    — password/PIN re-entry. Universal fallback.
//   • "otp"         — one-time code to email/SMS. Universal fallback.
//   • "face_vendor" — selfie + LIVENESS via a specialized identity vendor (Persona/Onfido/iProov/FaceTec…),
//                     for the highest-risk actions only. Biometric data is handled by the VENDOR, never built
//                     here — and it is regulated (BIPA/GDPR): consent + retention policy required. See counsel note.
//
// This module is the pure policy + freshness core. The actual capture (passkey assertion, OTP delivery, vendor
// liveness) happens at the edge/vendor; the server records a verified step-up and gates sensitive functions on it.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export type StepUpMethod = "passkey" | "password" | "otp" | "face_vendor";
export const ALL_METHODS: StepUpMethod[] = ["passkey", "password", "otp", "face_vendor"];

export const stepUpEnabled = () => snapBool("STEP_UP_ENABLED", false);
/** How long a step-up stays valid before it must be redone, in seconds (default 5 min). */
export const stepUpFreshnessSeconds = () => Math.max(30, snapNumber("STEP_UP_FRESHNESS_SECONDS", 300));

// Sensitive action → required assurance. "high" needs a strong method (passkey or vendor face); "standard"
// accepts any configured method. Unlisted actions are not gated.
export const ACTION_ASSURANCE: Record<string, "standard" | "high"> = {
  payout: "high", withdrawal: "high", kyc: "high", account_delete: "high", payment_method_change: "high",
  purchase: "standard", balance_transfer: "standard", advance_grant: "high", settings_change: "standard",
};
const HIGH_METHODS: StepUpMethod[] = ["passkey", "face_vendor"];

/** Which methods are enabled by the operator (comma list; default passkey,password,otp). Pure-ish (reads a setting). */
export function enabledMethods(): StepUpMethod[] {
  const raw = (snapString("STEP_UP_METHODS", "passkey,password,otp") || "passkey,password,otp").toLowerCase();
  const set = raw.split(",").map((s) => s.trim()).filter((m) => (ALL_METHODS as string[]).includes(m)) as StepUpMethod[];
  return set.length ? set : ["password", "otp"];
}

export interface StepUpRecord { method: StepUpMethod; verified_at: string; action_scope?: string; }
export interface StepUpDecision { required: boolean; acceptable_methods: StepUpMethod[]; reason: string; }

/** Is a stored step-up still fresh for `now`? Pure. */
export function isFresh(rec: StepUpRecord | null | undefined, nowMs: number, freshnessSeconds: number): boolean {
  if (!rec?.verified_at) return false;
  const t = Date.parse(rec.verified_at);
  return Number.isFinite(t) && (nowMs - t) <= freshnessSeconds * 1000;
}

/** Decide whether a sensitive action needs a (fresh) step-up and which methods are acceptable. Pure. */
export function stepUpRequired(
  action: string, last: StepUpRecord | null | undefined,
  cfg: { enabled: boolean; freshnessSeconds: number; methods: StepUpMethod[]; nowMs: number },
): StepUpDecision {
  const assurance = ACTION_ASSURANCE[action];
  if (!assurance) return { required: false, acceptable_methods: [], reason: "action not gated" };
  if (!cfg.enabled) return { required: false, acceptable_methods: [], reason: "step-up disabled (pending rollout)" };

  const acceptable = (assurance === "high" ? cfg.methods.filter((m) => HIGH_METHODS.includes(m)) : cfg.methods);
  const methods = acceptable.length ? acceptable : cfg.methods;   // never lock the user out entirely
  // Fresh step-up with an acceptable method already on file → not required again.
  if (last && isFresh(last, cfg.nowMs, cfg.freshnessSeconds) && methods.includes(last.method)) {
    return { required: false, acceptable_methods: methods, reason: "fresh step-up on file" };
  }
  return { required: true, acceptable_methods: methods, reason: `${assurance} action needs a fresh re-auth` };
}

/** Relative strength for choosing the best available method. Pure. */
export function methodStrength(m: StepUpMethod): number {
  return ({ passkey: 4, face_vendor: 3, otp: 2, password: 1 } as Record<StepUpMethod, number>)[m] ?? 0;
}

// ── DB-backed gate (the helper sensitive functions call) ────────────────────────────────────────────────
import { db } from "./db.ts";

/** The user's most recent verified step-up (any method). */
export async function latestStepUp(userId: string): Promise<StepUpRecord | null> {
  const rows = await db.filter("StepUpVerification", { user_id: userId }, "-verified_at", 1).catch(() => []) as Record<string, unknown>[];
  const r = rows?.[0];
  return r ? { method: String(r.method) as StepUpMethod, verified_at: String(r.verified_at), action_scope: r.action_scope ? String(r.action_scope) : undefined } : null;
}

/** The gate: does this user have a fresh, acceptable step-up for this action? Sensitive functions call this and
 *  return 403 with `decision` when `required` is true. When STEP_UP_ENABLED is off it returns required:false so
 *  nothing is blocked during rollout. */
export async function requireStepUp(userId: string, action: string): Promise<StepUpDecision> {
  const last = await latestStepUp(userId);
  return stepUpRequired(action, last, {
    enabled: stepUpEnabled(), freshnessSeconds: stepUpFreshnessSeconds(), methods: enabledMethods(), nowMs: Date.now(),
  });
}
