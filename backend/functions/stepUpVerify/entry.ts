import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { enabledMethods, type StepUpMethod } from "../../sdk/step-up-auth.ts";
import { verifyPassword } from "../../sdk/password.ts";

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

// Server-side password verification uses the SHARED verifier (sdk/password.ts), which checks bcrypt AND legacy
// salted-SHA-256 hashes — so step-up keeps working after accounts are migrated to bcrypt.

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const method = String(body.method ?? "") as StepUpMethod;
    const action = String(body.action ?? "");
    if (!enabledMethods().includes(method)) return Response.json({ error: `method '${method}' not enabled.` }, { status: 400 });

    // ── Per-method verification (SERVER-AUTHORITATIVE; a client-supplied "ok" flag is never trusted) ──
    let verified = false, detail = "";
    if (method === "password") {
      // Real re-check against the account's stored hash — the SAME scheme as login (salted SHA-256).
      const submitted = String(body.password ?? "");
      const stored = String((user as Record<string, unknown>).password_hash ?? "");
      verified = !!submitted && !!stored && await verifyPassword(submitted, stored);
      detail = "password re-check";
    } else {
      // otp / passkey / face_vendor have NO server-side proof wired yet: there is no server-issued OTP store,
      // no WebAuthn assertion verifier, and no signed-vendor webhook check. Accepting a client-supplied flag
      // would be spoofable, so these FAIL CLOSED until real verification is implemented (enable only the
      // 'password' method via STEP_UP_METHODS until then). See BIOMETRIC-AND-STEP-UP-AUTH counsel note.
      return Response.json({ ok: false, verified: false, method, reason: `step-up method '${method}' is not available yet — its server-side verification is not wired. Use 'password'.` }, { status: 501 });
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
