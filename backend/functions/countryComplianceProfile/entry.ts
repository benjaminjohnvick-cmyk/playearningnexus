import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { profileForCountry, resolveCountry, forceStrictestGlobally, type CountryProfile } from "../../sdk/country-compliance.ts";

// countryComplianceProfile — resolves the compliance posture to apply for the CALLER (or a requested country),
// auto-selected from the user's country: DB override (ComplianceProfile) → seeded registry → strict default.
// The frontend/app reads this to apply the right cookie-consent model, age-of-majority, and SCA requirement
// on the fly per country, from the database. It only ever returns a posture at least as strict as the floor.
//   { }              → the caller's resolved profile (from their account country / geo header)
//   { country: "FR" } → the profile for a specific country (admin/testing)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));

    const cc = String(body.country || "").trim() || resolveCountry(user, req);

    // Load any admin/counsel-approved per-country overrides (optional entity; absent → registry only).
    const overrides: Record<string, Partial<CountryProfile>> = {};
    try {
      const rows = await db.list("ComplianceProfile", "-updated_date", 500) as Record<string, unknown>[];
      for (const r of rows || []) {
        const code = String(r.country ?? "").trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(code) && (r.status ?? "active") === "active") {
          overrides[code] = {
            privacy_regime: r.privacy_regime as string | undefined,
            cookie_model: r.cookie_model as ("opt_in" | "opt_out") | undefined,
            age_of_majority: r.age_of_majority as number | undefined,
            sca_required: r.sca_required as boolean | undefined,
            data_transfer_note: r.data_transfer_note as string | undefined,
          };
        }
      }
    } catch { /* no overrides table → registry + default */ }

    const profile = profileForCountry(cc, overrides);
    return Response.json({
      ok: true,
      resolved_country: profile.country,
      force_strictest_global: forceStrictestGlobally(),
      profile,
      apply: {
        cookie_consent: profile.cookie_model,            // 'opt_in' (banner defaults off) | 'opt_out'
        min_age: profile.age_of_majority,
        sca_required: profile.sca_required,              // 3-D Secure on card payments
      },
      note: "Posture auto-selected from country; never less strict than the platform floor (opt-in / 18 / SCA on).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
