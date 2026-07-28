// Personalization + graduation lifecycle — the login/logout glue for option (b).
//
// The learning system reasons at the SEGMENT/aggregate level (a change must be significant across all
// the users in a segment, not one person's handful of clicks), then APPLIES the result per-user at
// login. A change that wins strongly for a segment is nominated to a site-wide validation; if that
// passes it flips globally (no downtime, reaches web + PWA + native).
//
//   • applyOnLogin  → resolve the user's effective variants (running experiments for their segment +
//     segment-kept promoted changes), snapshot them to UserVariantState, return them to the client.
//   • finalizeOnLogout → close the session; the per-segment aggregates it fed are evaluated by the
//     scheduled tick()/graduation, and any change that became a winner is applied at the user's NEXT
//     login automatically (because resolveVariantOverrides now includes it).

import { db } from "./db.ts";
import { isEnabled } from "./feature-flags.ts";
import { resolveVariantOverrides } from "./live-experiments.ts";

const nowISO = () => new Date().toISOString();

/** Derive a user's segment. Prefers the compiled UserAIProfile.segment (behavior-based); falls back to
 *  a lightweight heuristic from the User doc so login never blocks on a heavy recompute. Blends in the
 *  user's top KYC interest so personalization can key off "what they're into", not just activity. */
export async function userSegment(userId: string): Promise<string> {
  let base = "new";
  try {
    const prof = await db.filter("UserAIProfile", { user_id: userId }, "-updated_at", 1).catch(() => []) as any[];
    if (prof.length && prof[0].segment) base = String(prof[0].segment);
    else {
      const u = await db.get("User", userId).catch(() => null) as any;
      if (u) {
        const earn = Number(u.total_earnings) || 0;
        const age = Number(u.account_age_days) || 0;
        if (earn > 200) base = "whale";
        else if (earn > 0) base = "engaged";
        else if (age > 7) base = "at_risk";
      }
    }
  } catch { /* default "new" */ }

  // Blend top KYC interest (kept short so segments don't fragment into thousands of tiny buckets).
  try {
    const u = await db.get("User", userId).catch(() => null) as any;
    const cats = (u?.kyc_answers && Array.isArray(u.kyc_answers.categories)) ? u.kyc_answers.categories : [];
    if (cats.length) return `${base}:${String(cats[0]).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}`;
  } catch { /* ignore */ }
  return base;
}

// The most active BASE segment recently (interest suffix stripped) — the optimizer targets this for
// per-segment testing so the bucket is large enough to reach significance. Cached briefly.
let _segCache: { at: number; seg: string | null } | null = null;
export async function topBaseSegment(): Promise<string | null> {
  if (_segCache && Date.now() - _segCache.at < 5 * 60 * 1000) return _segCache.seg;
  let seg: string | null = null;
  try {
    const profs = await db.filter("UserAIProfile", {}, "-updated_at", 500).catch(() => []) as any[];
    const counts: Record<string, number> = {};
    for (const p of profs) {
      const base = String(p.segment || "").split(":")[0];
      if (base) counts[base] = (counts[base] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    // Only target a segment that has a reasonable population; else fall back to site-wide (null).
    if (top && top[1] >= 5) seg = top[0];
  } catch { /* null → site-wide */ }
  _segCache = { at: Date.now(), seg };
  return seg;
}

/** Login applier: resolve the user's effective variant overrides and snapshot the kept-change state. */
export async function applyOnLogin(user: any, sessionId?: string): Promise<{
  segment: string; settings: Record<string, unknown>; flags: Record<string, boolean>; ui: Record<string, string>;
  assignments: any[];
}> {
  const empty = { segment: "new", settings: {}, flags: {}, ui: {}, assignments: [] as any[] };
  if (!user?.id) return empty;
  if (!(await isEnabled("personalized_learning").catch(() => true))) {
    // Personalization off → only site-wide (global config) applies; return nothing extra.
    return { ...empty, segment: "off" };
  }
  const segment = await userSegment(user.id);
  const ov = await resolveVariantOverrides(user, sessionId, segment);

  // Snapshot the per-user kept-change state (inspectable/auditable; the source of truth stays the
  // experiments). Skip the write entirely when nothing changed since last login — a cheap fingerprint
  // compare avoids write amplification on every login/app-resume.
  try {
    const fp = JSON.stringify({ s: ov.settings, f: ov.flags, u: ov.ui });
    const existing = await db.filter("UserVariantState", { user_id: user.id }, "-at", 1).catch(() => []) as any[];
    const prev = existing[0];
    if (!prev || prev.fp !== fp) {
      const snapshot = { user_id: user.id, segment, applied: ov, fp, at: nowISO() };
      if (prev) await db.update("UserVariantState", prev.id, snapshot).catch(() => null);
      else await db.create("UserVariantState", snapshot, user.id).catch(() => null);
    }
  } catch { /* snapshot is best-effort */ }

  return { segment, settings: ov.settings, flags: ov.flags, ui: ov.ui, assignments: ov.assignments };
}

/** Logout finalizer: mark the session closed. Metrics were recorded live during the session; the
 *  scheduled tick()/graduation does the statistical evaluation, so a winner is auto-applied at the
 *  user's next login. Kept intentionally light so logout never blocks. */
export async function finalizeOnLogout(user: any, sessionId?: string, summary?: Record<string, unknown>): Promise<void> {
  if (!user?.id) return;
  try {
    await db.create("SessionClose", {
      user_id: user.id, session_id: String(sessionId || "").slice(0, 80),
      segment: await userSegment(user.id).catch(() => "new"),
      summary: summary && typeof summary === "object" ? summary : null, at: nowISO(),
    }, user.id).catch(() => null);
    await db.update("User", user.id, { last_logout_at: nowISO() }).catch(() => null);
  } catch { /* best-effort */ }
}
