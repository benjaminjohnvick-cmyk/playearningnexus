// password.ts — one place for password hashing + verification, using a slow KDF (bcrypt). Shared by the auth
// routes and the step-up verifier so they can never drift. BACKWARD-COMPATIBLE: it still verifies the old
// salted-SHA-256 hashes ("saltB64:hashB64") so existing users keep logging in, and the login route rehashes
// them to bcrypt on the next successful sign-in (see isLegacyHash). New hashes are always bcrypt.
//
// Why: single-round SHA-256 is fast to brute-force if a hash ever leaks; bcrypt's work factor makes offline
// cracking impractical — the strict credential-security standard.
import bcrypt from "npm:bcryptjs@2.4.3";

const ROUNDS = 12;

/** Hash a password with bcrypt (work factor 12). */
export async function hashPassword(pw: string): Promise<string> {
  return await bcrypt.hash(pw, ROUNDS);
}

/** True when the stored hash is the OLD salted-SHA-256 scheme (so it should be upgraded to bcrypt). */
export function isLegacyHash(stored: string): boolean {
  return !!stored && !stored.startsWith("$2");
}

/** Verify a password against either a bcrypt hash or a legacy salted-SHA-256 hash. */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  if (!pw || !stored) return false;
  if (stored.startsWith("$2")) {
    try { return await bcrypt.compare(pw, stored); } catch { return false; }
  }
  // Legacy: "base64(salt):base64(sha256(salt+pw))"
  try {
    const saltB64 = stored.split(":")[0];
    if (!saltB64) return false;
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const bits = await crypto.subtle.digest("SHA-256", new Uint8Array([...salt, ...new TextEncoder().encode(pw)]));
    const recomputed = btoa(String.fromCharCode(...salt)) + ":" + btoa(String.fromCharCode(...new Uint8Array(bits)));
    return recomputed === stored;
  } catch { return false; }
}
