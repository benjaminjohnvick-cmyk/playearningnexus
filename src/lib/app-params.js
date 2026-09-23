// app-params.js — parses the app's launch/bootstrap query params (base44-style) once at load and
// persists them, so they survive the OAuth round-trip and page reloads. The MCP OAuth consent page
// (and any bearer-token API call that needs it) reads `appParams.token` / `appParams.appId` from here.
//
// Bootstrap params handled — this is the SAME set `authReturnTo.js` strips from a returnTo value, so a
// param that is URL-read here can never be re-injected through a redirect:
//   access_token        the app access token — persisted under `nexus_token` (the key base44Client uses)
//   clear_access_token  when present, clears the stored token (sign-out round-trip)
//   app_id              the app id used in /api/apps/:appId/... routes — persisted
//   app_base_url        the app base URL — persisted
//   functions_version   the functions bundle version — persisted
//
// The URL params are consumed once on load; the persisted values are the source of truth thereafter.
// `token` is exposed as a live getter so it always reflects the current session (login/logout rewrite
// `nexus_token`); the rest are stable for the app's lifetime.

const TOKEN_KEY = "nexus_token";
const APP_ID_KEY = "nexus_app_id";
const APP_BASE_URL_KEY = "nexus_app_base_url";
const FUNCTIONS_VERSION_KEY = "nexus_functions_version";

const hasWindow = typeof window !== "undefined";

// localStorage helper that never throws (private mode, SSR, blocked storage).
function store(action, key, value) {
  try {
    if (typeof localStorage === "undefined") return null;
    if (action === "get") return localStorage.getItem(key);
    if (action === "set") {
      if (value == null || value === "") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return value;
    }
    if (action === "del") {
      localStorage.removeItem(key);
      return null;
    }
  } catch {
    /* storage unavailable — degrade to no persistence */
  }
  return null;
}

// Capture the bootstrap params from the URL exactly once, then persist them.
(function captureFromUrl() {
  if (!hasWindow) return;
  let q;
  try {
    q = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  if (q.get("clear_access_token") != null) store("del", TOKEN_KEY);
  const at = q.get("access_token");
  if (at) store("set", TOKEN_KEY, at);
  const appId = q.get("app_id");
  if (appId) store("set", APP_ID_KEY, appId);
  const baseUrl = q.get("app_base_url");
  if (baseUrl) store("set", APP_BASE_URL_KEY, baseUrl);
  const fnv = q.get("functions_version");
  if (fnv) store("set", FUNCTIONS_VERSION_KEY, fnv);
})();

const ENV_APP_ID =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_APP_ID) || "";

// Live view of the persisted launch params.
export const appParams = {
  get token() {
    return store("get", TOKEN_KEY) || "";
  },
  get appId() {
    return store("get", APP_ID_KEY) || ENV_APP_ID || "";
  },
  get appBaseUrl() {
    return store("get", APP_BASE_URL_KEY) || "";
  },
  get functionsVersion() {
    return store("get", FUNCTIONS_VERSION_KEY) || "";
  },
};

export default appParams;
