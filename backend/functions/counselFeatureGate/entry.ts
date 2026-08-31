import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setSetting, effectiveSettings, invalidateSettingsCache } from "../../sdk/settings.ts";

// counselFeatureGate — the single control for the features that ship OFF pending counsel. It (a) LISTS every
// pending-counsel flag with its current on/off state, and (b) enables/disables them — but a bulk enable
// requires an explicit acknowledgment (confirm: "COUNSEL_APPROVED"), so nothing legally-sensitive flips on by
// accident. Deliberately NOT a blind one-click: each feature below carries its own distinct legal question and
// should be enabled only after your attorney signs off on that specific one. Admin only. Audited via setSetting.
//
//   List:            POST {}                                   → current state of every pending-counsel flag
//   Enable some:     POST { enable: ["ADVANCE_ENABLED"], confirm: "COUNSEL_APPROVED" }
//   Enable all:      POST { enable: "all", confirm: "COUNSEL_APPROVED" }
//   Disable (revert):POST { disable: ["ADVANCE_ENABLED"] }     (no confirm needed to turn OFF)

// Each pending-counsel flag + the doc that states its legal questions.
const PENDING: Array<{ key: string; label: string; brief: string }> = [
  { key: "USAGE_FEE_ENABLED", label: "Daily usage fee ($1/day, from earnings)", brief: "PLATFORM-ADVANCE-AND-USAGE-FEE-LEGAL-BRIEF.md" },
  { key: "ADVANCE_ENABLED", label: "Free non-recourse purchasing-power advance", brief: "PLATFORM-ADVANCE-AND-USAGE-FEE-LEGAL-BRIEF.md" },
  { key: "REFERRAL_TIERS_ENABLED", label: "Two-tier referral bonus ($5 user / $2,000 advertiser)", brief: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md" },
  { key: "ENDORSER_ENABLED", label: "Paid-endorser rewards", brief: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md" },
  { key: "ENDORSER_PERSONALIZE_ENABLED", label: "Endorser AI personalization", brief: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md" },
  { key: "ENDORSER_AUTOPOST_ENABLED", label: "Endorser auto-posting", brief: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md" },
];
const KEYS = new Set(PENDING.map((p) => p.key));

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const all = await effectiveSettings().catch(() => []) as Array<{ key: string; value: string }>;
    const valOf = (k: string) => String((all.find((s) => s.key === k)?.value ?? "0")) === "1";

    const wantEnable: string[] = body.enable === "all" ? PENDING.map((p) => p.key)
      : Array.isArray(body.enable) ? body.enable.filter((k: string) => KEYS.has(k)) : [];
    const wantDisable: string[] = Array.isArray(body.disable) ? body.disable.filter((k: string) => KEYS.has(k)) : [];

    // Enabling requires the explicit counsel acknowledgment.
    if (wantEnable.length && body.confirm !== "COUNSEL_APPROVED") {
      return Response.json({
        ok: false, needs_confirm: true,
        message: "Enabling counsel-gated features requires confirm: \"COUNSEL_APPROVED\". Each feature should be enabled only after your attorney has signed off on that specific one.",
        features: PENDING.map((p) => ({ ...p, enabled: valOf(p.key) })),
      });
    }

    const changed: Array<{ key: string; to: string }> = [];
    for (const k of wantDisable) { await setSetting(k, "0", `counselGate:${user.email ?? user.id}`).catch(() => null); changed.push({ key: k, to: "0" }); }
    for (const k of wantEnable) { await setSetting(k, "1", `counselGate:${user.email ?? user.id}`).catch(() => null); changed.push({ key: k, to: "1" }); }
    if (changed.length) invalidateSettingsCache();

    const after = await effectiveSettings().catch(() => all) as Array<{ key: string; value: string }>;
    const valAfter = (k: string) => String((after.find((s) => s.key === k)?.value ?? "0")) === "1";

    return Response.json({
      ok: true, changed_count: changed.length, changed,
      features: PENDING.map((p) => ({ ...p, enabled: valAfter(p.key) })),
      note: changed.length ? "Updated. Each enabled feature is now live per its settings." : "No changes — this is the current pending-counsel state.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
