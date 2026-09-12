// api.js — thin client for the Get Goods Gratis backend (the Deno functions in the main repo).
//
// AUTH: the backend authenticates each call with a Bearer JWT — the same session token the website stores in
// localStorage under 'nexus_token'. The auth bridge (content-auth.js) copies that token into
// chrome.storage.local.authToken while the user is signed in on the site, and this client sends it as
// `Authorization: Bearer <token>`. No token → the surfaces show a "sign in on the site" state.
//
// The public HTTP route for a named backend function is POST {API_BASE}/functions/{name}. API_BASE defaults to
// production and can be overridden in Settings (chrome.storage.local.apiBase) for a custom domain.

export const DEFAULT_API_BASE = "https://playearningnexus-production.up.railway.app";

export async function getApiBase() {
  try {
    const { apiBase } = await chrome.storage.local.get("apiBase");
    return (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
  } catch { return DEFAULT_API_BASE; }
}

async function getAuthToken() {
  try { const { authToken } = await chrome.storage.local.get("authToken"); return authToken || null; } catch { return null; }
}

/** True when we have a session token (the user is signed in on the site and the bridge picked it up). */
export async function isSignedIn() { return !!(await getAuthToken()); }

/** Invoke a backend function. Returns parsed JSON (the function's Response.json body) or throws. */
export async function invoke(name, body = {}) {
  const base = await getApiBase();
  const headers = { "Content-Type": "application/json" };
  const token = await getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}/functions/${name}`, {
    method: "POST",
    headers,
    credentials: "include", // harmless; the Bearer token is the real auth
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Sign in on the site to start earning.");
  if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// Convenience wrappers for the endpoints this extension uses.
export const getConfig = () => invoke("extensionConfig", {});
export const enroll = (prefs) => invoke("extensionEnroll", prefs);
export const serveAd = () => invoke("extensionAdServe", {});         // { ad: {ad_id,title,image_url,url,advertiser_id,house} }
export const rewardAdView = (payload) => invoke("extensionAdReward", payload);
