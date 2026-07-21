// JWT auth — replaces base44.auth. Tokens are signed HS256 with AUTH_JWT_SECRET.
// The token's `sub` claim is the User row id. Issue tokens from your login/signup
// endpoints (see server/auth-routes.ts) or from AWS Cognito (set AUTH_MODE=cognito
// and verify against the Cognito JWKS — see MIGRATION-PLAN.md).
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SECRET = Deno.env.get("AUTH_JWT_SECRET") ?? "dev-secret-change-me";

async function key(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function signJwt(sub: string, extra: Record<string, unknown> = {}, ttlSeconds = 60 * 60 * 24 * 7) {
  return await create({ alg: "HS256", typ: "JWT" }, { sub, ...extra, exp: getNumericDate(ttlSeconds) }, await key());
}

export async function verifyJwt(token: string): Promise<{ sub: string } | null> {
  try { return await verify(token, await key()) as { sub: string }; }
  catch { return null; }
}
