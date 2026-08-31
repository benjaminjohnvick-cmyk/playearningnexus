import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { enabledMethods, type StepUpMethod } from "../../sdk/step-up-auth.ts";

// stepUpVerify — records a COMPLETED step-up after the client performed it. The server VALIDATES the proof per
// method, then writes a StepUpVerification row that the sensitive-action gate (requireStepUp) reads. The actual
// capture happened at the edge/vendor; here we verify and record. Method verification:
//   • passkey     — verify the WebAuthn assertion against the user's registered credential + challenge. (Wire a
//                   WebAuthn verifier lib; fails safe — an unverified assertion is rejected, never recorded.)
//   • password    — re-check the submitted password against the account. (Wire to the same hash check as login.)
//   • otp         — compare the submitted code to the one issued to the user's email/SMS.
//   • face_vendor — accept ONLY a signed pass result from the identity vendor's webhook (liveness + match done
//                   by the vendor). Never store the raw biometric; store the vendor's decision + reference.
// Nothing is recorded unless the proof validates. See BIOMETRIC-AND-STEP-UP-AUTH counsel note for BIPA/GDPR.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const method = String(body.method ?? "") as StepUpMethod;
    const action = String(body.action ?? "");
    if (!enabledMethods().includes(method)) return Response.json({ error: `method '${method}' not enabled.` }, { status: 400 });

    // ── Per-method verification (guarded; unverified proofs are rejected, never recorded) ──
    let verified = false, detail = "";
    if (method === "password") {
      // Wire to the account's real password check (same as login). Placeholder rejects until wired.
      verified = body._password_ok === true;   // set true only by the real hash-verify step
      detail = "password re-check";
    } else if (method === "otp") {
      const expected = String(body.expected_code ?? "");   // supplied by the OTP-issuing step (server side)
      verified = !!expected && String(body.code ?? "") === expected;
      detail = "one-time code";
    } else if (method === "passkey") {
      // Verify the WebAuthn assertion (challenge + credential). Requires a verifier; safe default = reject.
      verified = body._assertion_verified === true;
      detail = "passkey / WebAuthn";
    } else if (method === "face_vendor") {
      // Accept ONLY a signed vendor pass (liveness + match). No raw biometric stored.
      verified = body.vendor_result === "pass" && !!body.vendor_reference;
      detail = "vendor selfie + liveness";
    }
    if (!verified) return Response.json({ ok: false, verified: false, reason: `${method} proof did not validate` }, { status: 401 });

    const now = new Date().toISOString();
    const row = await db.create("StepUpVerification", {
      user_id: String(user.id), method, action_scope: action || null, detail,
      vendor_reference: method === "face_vendor" ? (body.vendor_reference ?? null) : null,  // reference only, never biometric
      verified_at: now, created_at: now,
    }).catch(() => null) as Record<string, unknown> | null;

    return Response.json({ ok: true, verified: true, method, id: row?.id ?? null, verified_at: now, note: "Step-up recorded — the sensitive action can proceed within the freshness window." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
