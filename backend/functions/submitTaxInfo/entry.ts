import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { maskTin } from "../../sdk/tax.ts";

// submitTaxInfo — a user submits their W-9 tax information (required before we can pay them at or
// above the 1099 threshold without backup withholding). Stores a TaxProfile and logs the
// certification to the consent ledger.
//
// SECURITY: the raw TIN/SSN is sensitive PII. In production it should be ENCRYPTED at rest or held
// by your 1099 filing provider (e.g. Track1099) rather than kept in plaintext. Treat the TaxProfile
// table as restricted; reports only ever surface the masked TIN.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { legal_name, business_name, tax_classification, tin_type, tin, address, city, state, zip, certification } = body;

    const missing: string[] = [];
    if (!legal_name) missing.push("legal_name");
    if (!tax_classification) missing.push("tax_classification (individual|sole_proprietor|llc|c_corp|s_corp|partnership)");
    if (tin_type !== "ssn" && tin_type !== "ein") missing.push("tin_type (ssn|ein)");
    if (!tin || String(tin).replace(/\D/g, "").length !== 9) missing.push("tin (9 digits)");
    if (certification !== true) missing.push("certification (certify the info is correct, under penalties of perjury)");
    if (missing.length) return Response.json({ error: "Incomplete W-9.", missing }, { status: 400 });

    const tinDigits = String(tin).replace(/\D/g, "");
    const rec = {
      user_id: user.id, legal_name, business_name: business_name ?? null, tax_classification,
      tin_type, tin: tinDigits, tin_masked: maskTin(tinDigits),
      address: address ?? null, city: city ?? null, state: state ?? null, zip: zip ?? null,
      certified: true, certified_at: new Date().toISOString(),
      w9_on_file: true, backup_withholding: false,
    };

    const existing = await base44.asServiceRole.entities.TaxProfile.filter({ user_id: user.id });
    if ((existing || []).length) await base44.asServiceRole.entities.TaxProfile.update(existing[0].id, rec);
    else await base44.asServiceRole.entities.TaxProfile.create(rec, user.id);

    await base44.asServiceRole.entities.User.update(user.id, { w9_on_file: true }).catch(() => null);
    await recordConsent({ user_id: user.id, kind: "w9_certification", accepted: true }).catch(() => null);

    return Response.json({ success: true, w9_on_file: true, tin_masked: maskTin(tinDigits) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
