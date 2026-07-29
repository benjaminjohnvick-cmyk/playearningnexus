// Email/password + Google auth issuing JWTs, replacing Base44's hosted auth.
// Includes password reset (token by email) and Sign in with Google.
import { db } from "../sdk/db.ts";
import { signJwt, verifyJwt } from "../sdk/auth.ts";
import { Core } from "../sdk/integrations.ts";
import { getNumber } from "../sdk/settings.ts";

const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173").replace(/\/$/, "");
const RESET_TTL_MIN = Number(Deno.env.get("RESET_TOKEN_TTL_MIN") ?? "60");

function hex(b: Uint8Array): string { return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function sha256Hex(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
}
function randomToken(): string { return hex(crypto.getRandomValues(new Uint8Array(32))); }

async function hash(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.digest("SHA-256", new Uint8Array([...salt, ...new TextEncoder().encode(pw)]));
  return btoa(String.fromCharCode(...salt)) + ":" + btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function checkPw(pw: string, stored: string): Promise<boolean> {
  const [saltB64] = stored.split(":");
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const bits = await crypto.subtle.digest("SHA-256", new Uint8Array([...salt, ...new TextEncoder().encode(pw)]));
  return btoa(String.fromCharCode(...salt)) + ":" + btoa(String.fromCharCode(...new Uint8Array(bits))) === stored;
}

export async function authRoutes(req: Request, pathname: string): Promise<Response> {
  if (pathname === "/auth/signup" && req.method === "POST") {
    const { email, password, full_name, date_of_birth, over_18 } = await req.json();
    if (!email || !password) return Response.json({ error: "email and password required" }, { status: 400 });

    // --- 18+ AGE GATE (compliance) ---------------------------------------------------------------
    // A money-earning app is 18+ only (removes COPPA and minor-contract exposure). Require either a
    // date of birth that computes to >= 18, or an explicit over-18 attestation. The attestation is
    // stored on the user record as evidence.
    const minAge = await getNumber("MIN_AGE", 18);
    let ageOk = false;
    let dobIso: string | null = null;
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      if (!isNaN(dob.getTime())) {
        dobIso = dob.toISOString().slice(0, 10);
        const years = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        ageOk = years >= minAge;
      }
    } else if (over_18 === true) {
      ageOk = true;
    }
    if (!ageOk) {
      return Response.json({ error: `You must be ${minAge} or older to use GamerGain. Please provide a date of birth showing you are at least ${minAge}.` }, { status: 403 });
    }
    // --------------------------------------------------------------------------------------------

    const existing = await db.filter("User", { email }, undefined, 1);
    if (existing.length) return Response.json({ error: "Email already registered" }, { status: 409 });
    const user = await db.create("User", {
      email, password_hash: await hash(password), role: "user", full_name,
      current_balance: 0, total_earnings: 0,
      date_of_birth: dobIso, age_verified_18plus: true, age_attestation_at: new Date().toISOString(),
    });
    const token = await signJwt(user.id as string, { email });
    return Response.json({ token, user: safeUser(user) });
  }

  if (pathname === "/auth/login" && req.method === "POST") {
    const { email, password } = await req.json();
    const rows = await db.filter("User", { email }, undefined, 1);
    const user = rows[0];
    if (!user || !user.password_hash || !(await checkPw(password, user.password_hash as string)))
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    const token = await signJwt(user.id as string, { email });
    return Response.json({ token, user: safeUser(user) });
  }

  if (pathname === "/auth/updateMe" && req.method === "POST") {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const patch = await req.json();
    delete patch.password_hash; delete patch.role; // don't let users self-elevate
    // AGE / IDENTITY VERIFICATION IS SERVER-ONLY. A client must never be able to mark itself 18+ or
    // change its DOB to pass the age gate — that's set at signup or by a server-side verification
    // path, never here. This closes the self-grant-18+ tamper vector.
    // jurisdiction/state are ALSO server-only: every compliance gate reads user.jurisdiction ?? user.state
    // (jackpot/tournament/sweepstakes eligibility, prize-registration thresholds, cash-out). If a client
    // could PATCH these it would defeat all jurisdiction gating (move itself out of a blocked/threshold
    // state). Set them at signup / by server-side KYC, never here.
    for (const f of ["age_verified_18plus", "needs_age_verification", "age_attestation_at", "date_of_birth", "jurisdiction", "state"]) {
      if (f in patch) {
        delete patch[f];
        try { await db.create("AppLog", { source: "security", event: "blocked_client_age_write", field: f, user_id: payload.sub, at: new Date().toISOString() }); } catch { /* non-fatal */ }
      }
    }
    // ECONOMY FIELDS ARE SERVER-ONLY. The client cannot set its own balance/earnings/points —
    // all balance changes must go through awardReward / spendBalance / placeStoreOrder /
    // purchaseStoreCredit (which use asServiceRole). This closes the client-side tamper vector.
    const PROTECTED_ECONOMY_FIELDS = [
      "current_balance", "total_earnings", "survey_balance", "commission_balance",
      "commission_earned", "virtual_currency", "points", "available_balance", "wallet_balance",
      "lifetime_earnings", "bnpl_credit_limit", "bnpl_active",
    ];
    let strippedEconomy = false;
    for (const f of PROTECTED_ECONOMY_FIELDS) { if (f in patch) { delete patch[f]; strippedEconomy = true; } }
    if (strippedEconomy) {
      // Surface any missed client call site instead of silently dropping it.
      try { await db.create("AppLog", { source: "security", event: "blocked_client_balance_write", user_id: payload.sub, at: new Date().toISOString() }); } catch { /* non-fatal */ }
    }
    const updated = await db.update("User", payload.sub, patch);
    return updated ? Response.json(safeUser(updated)) : Response.json({ error: "Not found" }, { status: 404 });
  }

  // --- Complete age verification (server-only setter for the 18+ gate) --------------------------
  // Google/social signups start with needs_age_verification=true. This is the ONLY path that sets
  // age_verified_18plus, so the age fields stay unsettable via /auth/updateMe (anti-tamper).
  if (pathname === "/auth/complete-age-verification" && req.method === "POST") {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { date_of_birth, over_18 } = await req.json().catch(() => ({}));
    const minAge = await getNumber("MIN_AGE", 18);

    let ageOk = false;
    let dobIso: string | null = null;
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      if (!isNaN(dob.getTime())) {
        dobIso = dob.toISOString().slice(0, 10);
        const years = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        ageOk = years >= minAge;
      }
    } else if (over_18 === true) {
      ageOk = true;
    }
    if (!ageOk) {
      return Response.json({ error: `You must be ${minAge} or older to use GamerGain.` }, { status: 403 });
    }
    const updated = await db.update("User", payload.sub, {
      date_of_birth: dobIso,
      age_verified_18plus: true,
      needs_age_verification: false,
      age_attestation_at: new Date().toISOString(),
    });
    return updated ? Response.json(safeUser(updated)) : Response.json({ error: "Not found" }, { status: 404 });
  }

  // --- Password reset: request a reset link by email ---
  if (pathname === "/auth/request-reset" && req.method === "POST") {
    const { email } = await req.json();
    const rows = email ? await db.filter("User", { email }, undefined, 1) : [];
    const user = rows[0];
    // Always return success (don't reveal whether an email is registered).
    if (user) {
      const token = randomToken();
      const expires = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000).toISOString();
      await db.update("User", user.id as string, { reset_token_hash: await sha256Hex(token), reset_token_expires: expires });
      const link = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      try {
        await Core.SendEmail({
          to: email,
          subject: "Reset your PlayEarning Nexus password",
          body: `<p>We received a request to reset your password.</p>
<p><a href="${link}">Click here to choose a new password</a>. This link expires in ${RESET_TTL_MIN} minutes.</p>
<p>If you didn't request this, you can ignore this email.</p>`,
        });
      } catch (e) { console.error("[request-reset] email failed:", (e as Error).message); }
      // DEV ONLY: return the link in the response so you can verify reset without email.
      if (Deno.env.get("DEV_RETURN_RESET_LINK") === "true") {
        return Response.json({ success: true, dev_reset_link: link });
      }
    }
    return Response.json({ success: true, message: "If that email exists, a reset link has been sent." });
  }

  // --- Password reset: set a new password with a valid token ---
  if (pathname === "/auth/reset-password" && req.method === "POST") {
    const { email, token, new_password } = await req.json();
    if (!email || !token || !new_password) return Response.json({ error: "email, token and new_password required" }, { status: 400 });
    if (String(new_password).length < 8) return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    const rows = await db.filter("User", { email }, undefined, 1);
    const user = rows[0];
    const okToken = user && user.reset_token_hash && user.reset_token_hash === await sha256Hex(token);
    const notExpired = user && user.reset_token_expires && new Date(user.reset_token_expires as string) > new Date();
    if (!okToken || !notExpired) return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
    await db.update("User", user.id as string, { password_hash: await hash(new_password), reset_token_hash: null, reset_token_expires: null });
    const jwt = await signJwt(user.id as string, { email });
    return Response.json({ success: true, token: jwt, user: safeUser({ ...user, password_hash: undefined }) });
  }

  // --- Admin: invite a user (creates the account + emails a set-password link) ---
  if (pathname === "/auth/invite" && req.method === "POST") {
    const authz = req.headers.get("authorization") ?? "";
    const tok = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = tok ? await verifyJwt(tok) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const inviter = await db.get("User", payload.sub);
    if (inviter?.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const { email, full_name, role } = await req.json();
    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const existing = await db.filter("User", { email }, undefined, 1);
    let user = existing[0];
    if (!user) user = await db.create("User", { email, role: role === "admin" ? "admin" : "user", full_name: full_name ?? "", invited_by: inviter.id, current_balance: 0, total_earnings: 0 });

    // Issue a set-password (reset) token so the invitee can choose a password.
    const token = randomToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day invite
    await db.update("User", user.id as string, { reset_token_hash: await sha256Hex(token), reset_token_expires: expires });
    const link = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    try {
      await Core.SendEmail({
        to: email,
        subject: "You've been invited to PlayEarning Nexus",
        body: `<p>${inviter.full_name || "An admin"} invited you to PlayEarning Nexus.</p>
<p><a href="${link}">Click here to set your password and get started</a>. This invite expires in 7 days.</p>`,
      });
    } catch (e) { console.error("[invite] email failed:", (e as Error).message); }
    return Response.json({ success: true, user_id: user.id, ...(Deno.env.get("DEV_RETURN_RESET_LINK") === "true" ? { dev_invite_link: link } : {}) });
  }

  // --- Sign in with Google (client sends a Google ID token) ---
  if (pathname === "/auth/google" && req.method === "POST") {
    const { id_token } = await req.json();
    if (!id_token) return Response.json({ error: "id_token required" }, { status: 400 });
    // Verify with Google's tokeninfo endpoint (checks signature + expiry server-side).
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!info || !info.email || (clientId && info.aud !== clientId)) {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }
    if (info.email_verified === "false") return Response.json({ error: "Google email not verified" }, { status: 401 });
    let rows = await db.filter("User", { email: info.email }, undefined, 1);
    let user = rows[0];
    if (!user) {
      // Google sign-in doesn't provide age. Create the account but mark it as needing the 18+
      // check so the app can prompt for a date of birth before any earning is enabled.
      user = await db.create("User", { email: info.email, role: "user", full_name: info.name ?? "", avatar_url: info.picture ?? "", google_sub: info.sub, current_balance: 0, total_earnings: 0, age_verified_18plus: false, needs_age_verification: true });
    }
    const jwt = await signJwt(user.id as string, { email: info.email });
    return Response.json({ token: jwt, user: safeUser(user) });
  }

  if (pathname === "/auth/me" && req.method === "GET") {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const user = await db.get("User", payload.sub);
    return user ? Response.json(safeUser(user)) : Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

function safeUser(u: Record<string, unknown>) { const { password_hash, reset_token_hash, reset_token_expires, ...rest } = u; return rest; }
