import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setSetting, effectiveSettings, invalidateSettingsCache, gatedBooleanFlags } from "../../sdk/settings.ts";

// counselFeatureGate — the single control for every gated-OFF feature flag. The list is DERIVED from the
// settings registry (every sensitive boolean that defaults OFF), so ANY new gated flag appears here
// automatically — no code change needed to surface it in the Setup Wizard. It (a) LISTS every gated flag with
// its current state, marking which ones are LEGAL (need counsel) vs operational, and (b) enables/disables them.
// Enabling a LEGAL flag requires confirm:"COUNSEL_APPROVED"; enabling an operational one requires confirm:true
// (or COUNSEL_APPROVED). Disabling never needs a confirm. Admin only. Audited via setSetting.
//
//   List:            POST {}
//   Enable one:      POST { enable: ["AUTO_SCALE_ENABLED"], confirm: true }
//   Enable a legal:  POST { enable: ["ADVANCE_ENABLED"], confirm: "COUNSEL_APPROVED" }
//   Enable all:      POST { enable: "all", confirm: "COUNSEL_APPROVED" }
//   Disable:         POST { disable: ["AUTO_SCALE_ENABLED"] }

// The legal flags + the brief that states each one's questions. Flags NOT in here are treated as operational.
const LEGAL_BRIEFS: Record<string, string> = {
  USAGE_FEE_ENABLED: "PLATFORM-ADVANCE-AND-USAGE-FEE-LEGAL-BRIEF.md",
  ADVANCE_ENABLED: "PLATFORM-ADVANCE-AND-USAGE-FEE-LEGAL-BRIEF.md",
  REFERRAL_TIERS_ENABLED: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md",
  ENDORSER_ENABLED: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md",
  ENDORSER_PERSONALIZE_ENABLED: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md",
  ENDORSER_AUTOPOST_ENABLED: "SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md",
  POINTS_CASHABLE: "COMPLIANCE-AND-CURRENT-STATE.md",
  // Founding-offer guardrails that MUST stay off in the clean Tier 1 model — enabling reads as
  // return-of-capital / charging members, so it requires counsel sign-off.
  FOUNDING_MEMBER_SHORTFALL_CHARGE: "FOUNDING-OFFER-LEGAL-REVIEW.md",
  FOUNDING_FULLKEEP_CAP_TO_PRICE: "FOUNDING-OFFER-LEGAL-REVIEW.md",
  // Flexible-payment (credit) opt-in — conditioning credit on a future purchase is regulated.
  FLEXPAY_NEXT_TIER_OPTIN: "FLEXIBLE-PAYMENT-TERMS-COMPLIANCE.md",
  // Live automated money movement out of the PayPal business account — reserve/stored-value, money-
  // transmitter posture, and PayPal-terms review all apply before this may be turned on.
  PAYPAL_AUTOSETTLE_ENABLED: "TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md",
  // Tier 2/3 default (opt-out) multi-year auto-renewal — a NEGATIVE-OPTION posture regulated by FTC/ROSCA and
  // state auto-renewal laws (advance-notice windows, express consent, easy cancellation). Counsel must clear
  // the disclosures and per-state notice timing before this may be turned on.
  TIER_AUTORENEW_ENABLED: "TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md",
  // Consumer PREMIUM default auto-renewal — the highest auto-renewal-law exposure (California ARL + ROSCA
  // apply squarely to consumer subscriptions). Same counsel note governs both the B2B and consumer cases.
  PREMIUM_AUTORENEW_ENABLED: "TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md",
  // AI compliance research assistant — drafts per-country legal-posture proposals. Proposals only (never auto-
  // applied), but counsel should approve turning the assistant on and own the review of what it drafts.
  COMPLIANCE_AI_RESEARCH_ENABLED: "GLOBAL-COMPLIANCE-AND-LOCALIZATION.md",
  // Revenue-lever COUNSEL gates — each is regulated or closed-loop-breaking. Enabling needs counsel sign-off
  // AND (for the placeholders) a dedicated build; the flag alone earns nothing. See the expansion brief.
  // Direct user-to-user Site-Cash transfer — a p2p transfer (money-transmission risk); the platform-funded
  // gift_boost is the compliant default. Requires counsel AND the p2p_transfers flag before it can run.
  SITE_CASH_GIFTING_ENABLED: "GIFT-BOOST.md",
  FINANCIAL_LEAD_GEN_ENABLED: "REVENUE-STREAMS-EXPANSION.md",
  FX_SPREAD_ENABLED: "REVENUE-STREAMS-EXPANSION.md",
  CRYPTO_PAYMENTS_ENABLED: "REVENUE-STREAMS-EXPANSION.md",
  NFT_MARKETPLACE_ENABLED: "REVENUE-STREAMS-EXPANSION.md",
  // Mobile earn hook + reminder → in-app rewarded ads. Rewarded-ad policy (user-initiated), notification
  // consent, no-guaranteed-earnings copy, and store review all apply before this may be turned on.
  EARN_HOOK_ENABLED: "EARN-HOOK-AND-REMINDER-COMPLIANT-DESIGN.md",
};

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const flags = gatedBooleanFlags();
    const KEYS = new Set(flags.map((f) => f.key));
    const isLegal = (k: string) => k in LEGAL_BRIEFS;

    const all = await effectiveSettings().catch(() => []) as Array<{ key: string; value: string }>;
    const valOf = (k: string) => String((all.find((s) => s.key === k)?.value ?? "0")) === "1";
    const describe = () => flags.map((f) => ({ key: f.key, label: f.label, category: f.category, legal: isLegal(f.key), brief: LEGAL_BRIEFS[f.key] ?? null, enabled: valOf(f.key) }));

    const wantEnable: string[] = body.enable === "all" ? flags.map((f) => f.key)
      : Array.isArray(body.enable) ? body.enable.filter((k: string) => KEYS.has(k)) : [];
    const wantDisable: string[] = Array.isArray(body.disable) ? body.disable.filter((k: string) => KEYS.has(k)) : [];

    // Enabling a LEGAL flag needs the counsel acknowledgment; an operational one needs any confirm.
    const enablingLegal = wantEnable.some((k) => isLegal(k));
    if (wantEnable.length) {
      if (enablingLegal && body.confirm !== "COUNSEL_APPROVED") {
        return Response.json({ ok: false, needs_confirm: "COUNSEL_APPROVED", message: "Enabling a counsel-gated (legal) feature requires confirm:\"COUNSEL_APPROVED\" — enable each only after your attorney signs off on that specific one.", features: describe() });
      }
      if (!enablingLegal && body.confirm !== true && body.confirm !== "COUNSEL_APPROVED") {
        return Response.json({ ok: false, needs_confirm: true, message: "Enabling a gated feature requires confirm:true.", features: describe() });
      }
    }

    const changed: Array<{ key: string; to: string }> = [];
    for (const k of wantDisable) { await setSetting(k, "0", `gate:${user.email ?? user.id}`).catch(() => null); changed.push({ key: k, to: "0" }); }
    for (const k of wantEnable) { await setSetting(k, "1", `gate:${user.email ?? user.id}`).catch(() => null); changed.push({ key: k, to: "1" }); }
    if (changed.length) invalidateSettingsCache();

    return Response.json({
      ok: true, changed_count: changed.length, changed, features: describe(),
      note: changed.length ? "Updated." : "Current gated-feature state (auto-derived from the settings registry).",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
