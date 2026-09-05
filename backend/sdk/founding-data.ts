// founding-data.ts — comprehensive FIRST-PARTY data collection for the pre-revenue / founding panel.
//
// The founding tier gets the whole catalog free and, as a measured privilege, helps find product-market fit.
// This module collects their activity comprehensively so the AI model can learn from it — but ONLY within the
// first-party categories already disclosed in the privacy policy, and only with the member's founding/PMF
// consent on file. It is deliberately incapable of collecting a NEW data category: the hard guard
// (FOUNDING_DATA_FIRST_PARTY_ONLY) refuses any category not marked first-party in the manifest, so turning
// "collect everything" on can never quietly become "collect a new kind of personal data." No third-party
// sharing — the signals feed the internal model/optimizer only.

import { db } from "./db.ts";
import { snapBool, snapString } from "./settings.ts";
import { hasConsented } from "./consent-ledger.ts";

export interface DataCategory { category: string; label: string; first_party: boolean; disclosed: boolean; source: string; }

// Built-in manifest — EVERY category is first-party and already disclosed. Nothing here is a new data category.
export const FOUNDING_DATA_MANIFEST: DataCategory[] = [
  { category: "profile", label: "Account profile the member provides", first_party: true, disclosed: true, source: "User" },
  { category: "preferences", label: "Settings, opt-ins, and choices", first_party: true, disclosed: true, source: "User/GlobalSettings" },
  { category: "interactions", label: "In-app clicks, views, navigation, scroll", first_party: true, disclosed: true, source: "InteractionEvent" },
  { category: "feature_use", label: "Which features are used, and how often", first_party: true, disclosed: true, source: "FeatureUsageEvent" },
  { category: "surveys", label: "Survey participation and answers", first_party: true, disclosed: true, source: "PPCSurveyResponse" },
  { category: "engagement", label: "Daily activity, streaks, sessions", first_party: true, disclosed: true, source: "DailyEarnings" },
  { category: "feedback", label: "Feedback and beta notes (the founding privilege)", first_party: true, disclosed: true, source: "FeedbackEvent" },
  { category: "referrals", label: "Referral and invite activity", first_party: true, disclosed: true, source: "Referral" },
  { category: "transactions", label: "Closed-loop Site Cash and order activity", first_party: true, disclosed: true, source: "Order/RevenueEvent" },
  { category: "session_telemetry", label: "Session and device context already collected", first_party: true, disclosed: true, source: "InteractionEvent" },
  { category: "support", label: "Support interactions", first_party: true, disclosed: true, source: "SupportTicket" },
];

export const foundingDataEnabled = () => snapBool("FOUNDING_DATA_COLLECTION_ENABLED", true);
export const foundingDataFirstPartyOnly = () => snapBool("FOUNDING_DATA_FIRST_PARTY_ONLY", true);
export const foundingDataRequireConsent = () => snapBool("FOUNDING_DATA_REQUIRE_CONSENT", true);

/** The active category manifest (a JSON override, else the built-in first-party manifest). */
export function foundingDataManifest(): DataCategory[] {
  const raw = snapString("FOUNDING_DATA_MANIFEST_JSON", "");
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j) && j.length) {
        return j.map((c: Record<string, unknown>) => ({
          category: String(c.category ?? ""), label: String(c.label ?? c.category ?? ""),
          first_party: c.first_party !== false, disclosed: c.disclosed !== false, source: String(c.source ?? ""),
        })).filter((c) => c.category);
      }
    } catch { /* fall back to the built-in manifest */ }
  }
  return FOUNDING_DATA_MANIFEST;
}

/** Is `category` allowed to be collected? Under the hard guard (default), only first-party + disclosed
 *  categories in the manifest pass. This is the wall that keeps "collect all data" from ever becoming a new
 *  data category without a privacy-policy update + counsel. Pure. */
export function categoryAllowed(category: string): { ok: boolean; reason: string } {
  const c = foundingDataManifest().find((m) => m.category === String(category));
  if (!c) return { ok: false, reason: `category "${category}" is not in the first-party manifest` };
  if (foundingDataFirstPartyOnly() && (!c.first_party || !c.disclosed)) {
    return { ok: false, reason: `category "${category}" is not first-party/disclosed — needs a privacy-policy update + counsel` };
  }
  return { ok: true, reason: "first-party, disclosed" };
}

// The consent kinds accepted as "this member is a consenting founding panelist."
const FOUNDING_CONSENT_KINDS = ["founding_panel", "pmf_panel", "founding_offer", "terms"];

async function hasFoundingConsent(userId: string): Promise<boolean> {
  for (const k of FOUNDING_CONSENT_KINDS) {
    if (await hasConsented(userId, k).catch(() => false)) return true;
  }
  return false;
}

export interface FoundingSignalInput {
  user_id: string; category: string; key?: string | null; value?: unknown; founding?: boolean; meta?: Record<string, unknown>;
}

/** Record ONE comprehensive first-party founding signal. Never throws. No-ops unless collection is enabled, the
 *  category is allowed by the hard guard, and (when required) the member's founding/PMF consent is on file. */
export async function recordFoundingSignal(input: FoundingSignalInput): Promise<{ recorded: boolean; reason: string }> {
  try {
    if (!foundingDataEnabled()) return { recorded: false, reason: "collection disabled" };
    const uid = String(input.user_id || "");
    if (!uid) return { recorded: false, reason: "no user" };
    const allowed = categoryAllowed(input.category);
    if (!allowed.ok) return { recorded: false, reason: allowed.reason };
    if (foundingDataRequireConsent() && !(await hasFoundingConsent(uid))) return { recorded: false, reason: "no founding/PMF consent on file" };
    await db.create("FoundingDataSignal", {
      user_id: uid,
      category: String(input.category),
      key: input.key ? String(input.key).slice(0, 120) : null,
      value: input.value ?? null,
      first_party: true,
      founding: input.founding !== false,
      meta: input.meta ?? {},
      at: new Date().toISOString(),
    }, uid);
    return { recorded: true, reason: "recorded" };
  } catch { return { recorded: false, reason: "error" }; }
}

/** Admin scope read: the manifest + per-category volume in the window. Proves exactly what is (and isn't)
 *  collected — a compliance-friendly, honest view of the founding data footprint. */
export async function buildFoundingDataScope(windowDays = 30): Promise<Record<string, unknown>> {
  const since = new Date(Date.now() - Math.max(1, windowDays) * 86400000).toISOString();
  const rows = await db.filter("FoundingDataSignal", {}, "-at", 8000).catch(() => []) as Record<string, unknown>[];
  const recent = rows.filter((r) => String(r.at || "") >= since);
  const byCat: Record<string, { count: number; users: Set<string> }> = {};
  for (const r of recent) {
    const c = String(r.category || "other");
    (byCat[c] ??= { count: 0, users: new Set<string>() });
    byCat[c].count++;
    if (r.user_id) byCat[c].users.add(String(r.user_id));
  }
  const manifest = foundingDataManifest();
  const categories = manifest.map((m) => ({
    ...m, signals: byCat[m.category]?.count ?? 0, distinct_users: byCat[m.category]?.users.size ?? 0,
  }));
  return {
    enabled: foundingDataEnabled(),
    first_party_only: foundingDataFirstPartyOnly(),
    require_consent: foundingDataRequireConsent(),
    window_days: windowDays,
    total_signals: recent.length,
    distinct_users: new Set(recent.map((r) => String(r.user_id || "")).filter(Boolean)).size,
    category_count: manifest.length,
    categories,
    note: "First-party, disclosed categories only. The hard guard refuses any category not marked first-party; no third-party sharing; signals feed the internal model/optimizer only.",
  };
}
